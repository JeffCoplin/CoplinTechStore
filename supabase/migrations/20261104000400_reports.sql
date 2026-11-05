-- CoplinTech · Consultas agregadas para dashboard y reportes
-- Los períodos se reciben como fechas locales (inclusive) y se interpretan en
-- America/Santo_Domingo. Solo cuentan ventas con status = 'completed' y gastos no anulados.
-- Son SECURITY INVOKER: además de assert_owner(), RLS sigue aplicando.

create or replace function public.local_day_start(p_date date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_date::timestamp at time zone 'America/Santo_Domingo');
$$;

create or replace function public.assert_valid_period(p_start date, p_end date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Período inválido' using errcode = '22023';
  end if;
  if p_end - p_start > 1100 then
    raise exception 'El período no puede superar 3 años' using errcode = '22023';
  end if;
end;
$$;

-- Ventas completadas del período (base común de todos los reportes).
create or replace function public.completed_sales_in_period(p_start date, p_end date)
returns setof public.sales
language sql
stable
security invoker
set search_path = ''
as $$
  select s.*
  from public.sales s
  where s.status = 'completed'
    and s.created_at >= public.local_day_start(p_start)
    and s.created_at <  public.local_day_start(p_end + 1);
$$;

-- ---------------------------------------------------------------------------
-- Resumen (tarjetas del dashboard)
-- ---------------------------------------------------------------------------

create or replace function public.report_summary(p_start date, p_end date)
returns table (
  gross_sales       numeric,
  discount_total    numeric,
  net_sales         numeric,
  cost_of_goods     numeric,
  gross_profit      numeric,
  expenses_total    numeric,
  operating_result  numeric,
  sales_count       integer,
  average_ticket    numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.assert_owner();
  perform public.assert_valid_period(p_start, p_end);

  return query
  with s as (
    select * from public.completed_sales_in_period(p_start, p_end)
  ),
  agg as (
    select coalesce(sum(s.subtotal), 0)::numeric(12,2)        as gross_sales,
           coalesce(sum(s.discount_amount), 0)::numeric(12,2) as discount_total,
           coalesce(sum(s.total), 0)::numeric(12,2)           as net_sales,
           count(*)::integer                                  as sales_count
    from s
  ),
  cogs as (
    select coalesce(sum(si.unit_cost_price * si.quantity), 0)::numeric(12,2) as cost_of_goods
    from public.sale_items si
    join s on s.id = si.sale_id
  ),
  exp as (
    select coalesce(sum(e.amount), 0)::numeric(12,2) as expenses_total
    from public.expenses e
    where not e.is_voided
      and e.expense_date between p_start and p_end
  )
  select agg.gross_sales,
         agg.discount_total,
         agg.net_sales,
         cogs.cost_of_goods,
         (agg.net_sales - cogs.cost_of_goods)::numeric(12,2),
         exp.expenses_total,
         (agg.net_sales - cogs.cost_of_goods - exp.expenses_total)::numeric(12,2),
         agg.sales_count,
         case when agg.sales_count = 0 then 0::numeric(12,2)
              else round(agg.net_sales / agg.sales_count, 2) end
  from agg, cogs, exp;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ventas por día (incluye días sin ventas)
-- ---------------------------------------------------------------------------

create or replace function public.report_sales_by_day(p_start date, p_end date)
returns table (day date, net_sales numeric, gross_profit numeric, sales_count integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.assert_owner();
  perform public.assert_valid_period(p_start, p_end);

  return query
  with s as (
    select cs.id, cs.total,
           (cs.created_at at time zone 'America/Santo_Domingo')::date as local_day
    from public.completed_sales_in_period(p_start, p_end) cs
  ),
  costs as (
    select si.sale_id, sum(si.unit_cost_price * si.quantity) as cost
    from public.sale_items si
    where si.sale_id in (select s.id from s)
    group by si.sale_id
  ),
  days as (
    select d::date as day from generate_series(p_start, p_end, interval '1 day') d
  )
  select days.day,
         coalesce(sum(s.total), 0)::numeric(12,2),
         coalesce(sum(s.total - coalesce(costs.cost, 0)), 0)::numeric(12,2),
         count(s.id)::integer
  from days
  left join s on s.local_day = days.day
  left join costs on costs.sale_id = s.id
  group by days.day
  order by days.day;
end;
$$;

-- ---------------------------------------------------------------------------
-- Desempeño por producto (unidades, importe neto, costo, ganancia bruta)
-- El descuento global de cada venta se prorratea entre sus líneas para que
-- la suma por producto coincida con el resumen.
-- ---------------------------------------------------------------------------

create or replace function public.report_product_performance(p_start date, p_end date)
returns table (
  product_id    uuid,
  product_name  text,
  sku           text,
  units         integer,
  net_amount    numeric,
  cost_amount   numeric,
  gross_profit  numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.assert_owner();
  perform public.assert_valid_period(p_start, p_end);

  return query
  with s as (
    select * from public.completed_sales_in_period(p_start, p_end)
  ),
  lines as (
    select si.product_id,
           si.product_name_snapshot,
           si.sku_snapshot,
           si.quantity,
           si.unit_cost_price * si.quantity as cost,
           case when s.subtotal = 0 then 0
                else si.line_subtotal - (s.discount_amount * si.line_subtotal / s.subtotal) end as net
    from public.sale_items si
    join s on s.id = si.sale_id
  )
  select l.product_id,
         (array_agg(l.product_name_snapshot))[1],
         (array_agg(l.sku_snapshot))[1],
         sum(l.quantity)::integer,
         round(sum(l.net), 2),
         round(sum(l.cost), 2),
         round(sum(l.net) - sum(l.cost), 2)
  from lines l
  group by l.product_id
  order by sum(l.quantity) desc, sum(l.net) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Métodos de pago
-- ---------------------------------------------------------------------------

create or replace function public.report_payment_methods(p_start date, p_end date)
returns table (payment_method text, sales_count integer, net_sales numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.assert_owner();
  perform public.assert_valid_period(p_start, p_end);

  return query
  select s.payment_method, count(*)::integer, sum(s.total)::numeric(12,2)
  from public.completed_sales_in_period(p_start, p_end) s
  group by s.payment_method
  order by sum(s.total) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gastos por categoría
-- ---------------------------------------------------------------------------

create or replace function public.report_expenses_by_category(p_start date, p_end date)
returns table (category text, expense_count integer, total numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.assert_owner();
  perform public.assert_valid_period(p_start, p_end);

  return query
  select e.category, count(*)::integer, sum(e.amount)::numeric(12,2)
  from public.expenses e
  where not e.is_voided
    and e.expense_date between p_start and p_end
  group by e.category
  order by sum(e.amount) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteo de inventario para el dashboard
-- ---------------------------------------------------------------------------

create or replace function public.inventory_status_counts()
returns table (available integer, low_stock integer, out_of_stock integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.assert_owner();
  return query
  select count(*) filter (where public.availability_status(p.stock_quantity, p.low_stock_threshold) = 'available')::integer,
         count(*) filter (where public.availability_status(p.stock_quantity, p.low_stock_threshold) = 'low_stock')::integer,
         count(*) filter (where public.availability_status(p.stock_quantity, p.low_stock_threshold) = 'out_of_stock')::integer
  from public.products p
  where p.is_active;
end;
$$;

-- Productos activos que requieren reposición (pocas unidades o agotados).
create or replace function public.products_needing_restock(p_limit integer default 50)
returns table (
  id uuid, name text, sku text, stock_quantity integer, low_stock_threshold integer, availability text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.assert_owner();
  return query
  select p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold,
         public.availability_status(p.stock_quantity, p.low_stock_threshold)
  from public.products p
  where p.is_active
    and p.stock_quantity <= p.low_stock_threshold
  order by p.stock_quantity asc, p.name asc
  limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;

-- Permisos: solo authenticated (y dentro, solo el propietario pasa assert_owner).
revoke all on function public.local_day_start(date) from public, anon;
revoke all on function public.assert_valid_period(date, date) from public, anon;
revoke all on function public.completed_sales_in_period(date, date) from public, anon;
revoke all on function public.report_summary(date, date) from public, anon;
revoke all on function public.report_sales_by_day(date, date) from public, anon;
revoke all on function public.report_product_performance(date, date) from public, anon;
revoke all on function public.report_payment_methods(date, date) from public, anon;
revoke all on function public.report_expenses_by_category(date, date) from public, anon;
revoke all on function public.inventory_status_counts() from public, anon;
revoke all on function public.products_needing_restock(integer) from public, anon;

grant execute on function public.local_day_start(date) to authenticated;
grant execute on function public.assert_valid_period(date, date) to authenticated;
grant execute on function public.completed_sales_in_period(date, date) to authenticated;
grant execute on function public.report_summary(date, date) to authenticated;
grant execute on function public.report_sales_by_day(date, date) to authenticated;
grant execute on function public.report_product_performance(date, date) to authenticated;
grant execute on function public.report_payment_methods(date, date) to authenticated;
grant execute on function public.report_expenses_by_category(date, date) to authenticated;
grant execute on function public.inventory_status_counts() to authenticated;
grant execute on function public.products_needing_restock(integer) to authenticated;
