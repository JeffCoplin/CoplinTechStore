-- CoplinTech · Operaciones transaccionales de inventario y ventas
-- Toda modificación de existencias pasa por estas funciones.

-- ---------------------------------------------------------------------------
-- record_stock_movement: entradas (restock) y ajustes (+/-) con motivo
-- ---------------------------------------------------------------------------

create or replace function public.record_stock_movement(
  p_product_id    uuid,
  p_movement_type text,
  p_quantity_delta integer,
  p_reason        text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := public.assert_owner();
  v_before  integer;
  v_after   integer;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_row     public.stock_movements;
begin
  if p_movement_type not in ('restock', 'adjustment') then
    raise exception 'Tipo de movimiento no permitido' using errcode = '22023';
  end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'La cantidad debe ser distinta de cero' using errcode = '22023';
  end if;
  if p_movement_type = 'restock' and p_quantity_delta < 0 then
    raise exception 'Una entrada debe ser positiva' using errcode = '22023';
  end if;
  if p_movement_type = 'adjustment' and v_reason is null then
    raise exception 'El ajuste requiere un motivo' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 300 then
    raise exception 'El motivo es demasiado largo' using errcode = '22023';
  end if;

  select p.stock_quantity into v_before
  from public.products p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;

  v_after := v_before + p_quantity_delta;
  if v_after < 0 then
    raise exception 'La operación dejaría la existencia en negativo (actual: %)', v_before
      using errcode = 'P0001', hint = 'insufficient_stock';
  end if;

  update public.products set stock_quantity = v_after where id = p_product_id;

  insert into public.stock_movements
    (product_id, movement_type, quantity_delta, quantity_before, quantity_after, reason, created_by)
  values
    (p_product_id, p_movement_type, p_quantity_delta, v_before, v_after, v_reason, v_uid)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_sale: venta física atómica e idempotente
--   p_items: [{"product_id": uuid, "quantity": int}, ...]
--   El navegador solo envía productos, cantidades, método, descuento y recibido.
--   Precios, costos, subtotal, total y cambio se calculan aquí.
-- ---------------------------------------------------------------------------

create or replace function public.create_sale(
  p_client_request_id uuid,
  p_items             jsonb,
  p_payment_method    text,
  p_discount_amount   numeric default 0,
  p_amount_received   numeric default null,
  p_note              text default null
)
returns table (sale_id uuid, sale_number text, total numeric, change_amount numeric, already_existed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid       uuid := public.assert_owner();
  v_existing  public.sales;
  v_sale_id   uuid;
  v_number    text;
  v_subtotal  numeric(12,2) := 0;
  v_discount  numeric(12,2);
  v_total     numeric(12,2);
  v_received  numeric(12,2);
  v_change    numeric(12,2);
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
  v_item      record;
  v_lines     integer;
begin
  if p_client_request_id is null then
    raise exception 'Falta la clave de idempotencia' using errcode = '22023';
  end if;

  -- Serializa reintentos con la misma clave y devuelve la venta existente.
  perform pg_advisory_xact_lock(hashtextextended(p_client_request_id::text, 0));

  select * into v_existing from public.sales s where s.client_request_id = p_client_request_id;
  if found then
    return query select v_existing.id, v_existing.sale_number, v_existing.total, v_existing.change_amount, true;
    return;
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'bank_transfer', 'card') then
    raise exception 'Método de pago inválido' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'La nota es demasiado larga' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene artículos' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Demasiados artículos en una venta' using errcode = '22023';
  end if;

  -- Validación estricta de cada línea: product_id uuid y quantity entero > 0.
  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    where case
            when jsonb_typeof(e) <> 'object' then true
            when jsonb_typeof(e -> 'quantity') is distinct from 'number' then true
            when (e ->> 'quantity')::numeric <= 0 then true
            when (e ->> 'quantity')::numeric <> trunc((e ->> 'quantity')::numeric) then true
            when (e ->> 'quantity')::numeric > 100000 then true
            else coalesce(e ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          end
  ) then
    raise exception 'Artículos inválidos: cantidades enteras mayores que cero' using errcode = '22023';
  end if;

  -- Agrupa líneas repetidas del mismo producto.
  create temporary table if not exists pg_temp.sale_lines (
    product_id uuid primary key,
    quantity   integer not null
  ) on commit drop;
  truncate pg_temp.sale_lines;

  insert into pg_temp.sale_lines (product_id, quantity)
  select (e ->> 'product_id')::uuid, sum((e ->> 'quantity')::integer)
  from jsonb_array_elements(p_items) e
  group by 1;

  -- Bloquea las filas en orden estable (evita interbloqueos) y valida.
  for v_item in
    select l.product_id, l.quantity, p.name, p.stock_quantity, p.is_active, p.id as found_id
    from pg_temp.sale_lines l
    left join public.products p on p.id = l.product_id
    order by l.product_id
  loop
    if v_item.found_id is null then
      raise exception 'Producto no encontrado' using errcode = 'P0002';
    end if;
  end loop;

  perform 1
  from public.products p
  where p.id in (select l.product_id from pg_temp.sale_lines l)
  order by p.id
  for update;

  for v_item in
    select l.product_id, l.quantity, p.name, p.stock_quantity, p.is_active
    from pg_temp.sale_lines l
    join public.products p on p.id = l.product_id
    order by l.product_id
  loop
    if not v_item.is_active then
      raise exception 'El producto "%" está inactivo', v_item.name
        using errcode = 'P0001', hint = 'inactive_product';
    end if;
    if v_item.stock_quantity < v_item.quantity then
      raise exception 'Existencia insuficiente para "%" (disponible: %, solicitado: %)',
        v_item.name, v_item.stock_quantity, v_item.quantity
        using errcode = 'P0001', hint = 'insufficient_stock';
    end if;
  end loop;

  select coalesce(sum(round(p.sale_price * l.quantity, 2)), 0)
    into v_subtotal
  from pg_temp.sale_lines l
  join public.products p on p.id = l.product_id;

  v_discount := round(coalesce(p_discount_amount, 0), 2);
  if v_discount < 0 then
    raise exception 'El descuento no puede ser negativo' using errcode = '22023';
  end if;
  if v_discount > v_subtotal then
    raise exception 'El descuento no puede ser mayor que el subtotal' using errcode = '22023';
  end if;

  v_total := v_subtotal - v_discount;

  if p_payment_method = 'cash' then
    v_received := round(coalesce(p_amount_received, -1), 2);
    if v_received < v_total then
      raise exception 'El importe recibido es menor que el total' using errcode = '22023';
    end if;
    v_change := v_received - v_total;
  else
    v_received := v_total;
    v_change := 0;
  end if;

  v_number := 'CP-' || lpad(nextval('public.sale_number_seq')::text, 6, '0');

  insert into public.sales
    (sale_number, status, payment_method, subtotal, discount_amount, total,
     amount_received, change_amount, note, client_request_id, created_by)
  values
    (v_number, 'completed', p_payment_method, v_subtotal, v_discount, v_total,
     v_received, v_change, v_note, p_client_request_id, v_uid)
  returning id into v_sale_id;

  insert into public.sale_items
    (sale_id, product_id, product_name_snapshot, sku_snapshot, quantity,
     unit_sale_price, unit_cost_price, line_subtotal)
  select v_sale_id, p.id, p.name, p.sku, l.quantity, p.sale_price, p.cost_price,
         round(p.sale_price * l.quantity, 2)
  from pg_temp.sale_lines l
  join public.products p on p.id = l.product_id;

  insert into public.stock_movements
    (product_id, movement_type, quantity_delta, quantity_before, quantity_after, sale_id, created_by)
  select p.id, 'sale', -l.quantity, p.stock_quantity, p.stock_quantity - l.quantity, v_sale_id, v_uid
  from pg_temp.sale_lines l
  join public.products p on p.id = l.product_id;

  update public.products p
     set stock_quantity = p.stock_quantity - l.quantity
    from pg_temp.sale_lines l
   where p.id = l.product_id;

  get diagnostics v_lines = row_count;
  if v_lines <> (select count(*) from pg_temp.sale_lines) then
    raise exception 'Inconsistencia al descontar existencias' using errcode = 'P0001';
  end if;

  return query select v_sale_id, v_number, v_total, v_change, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- void_sale: anulación transaccional con movimientos compensatorios
-- ---------------------------------------------------------------------------

create or replace function public.void_sale(p_sale_id uuid, p_reason text)
returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := public.assert_owner();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_sale   public.sales;
begin
  if v_reason is null then
    raise exception 'La anulación requiere un motivo' using errcode = '22023';
  end if;
  if char_length(v_reason) > 300 then
    raise exception 'El motivo es demasiado largo' using errcode = '22023';
  end if;

  select * into v_sale from public.sales s where s.id = p_sale_id for update;
  if not found then
    raise exception 'Venta no encontrada' using errcode = 'P0002';
  end if;
  if v_sale.status = 'voided' then
    raise exception 'La venta % ya fue anulada', v_sale.sale_number
      using errcode = 'P0001', hint = 'already_voided';
  end if;

  -- Bloqueo en orden estable de los productos afectados.
  perform 1
  from public.products p
  where p.id in (select si.product_id from public.sale_items si where si.sale_id = p_sale_id)
  order by p.id
  for update;

  insert into public.stock_movements
    (product_id, movement_type, quantity_delta, quantity_before, quantity_after, sale_id, reason, created_by)
  select p.id, 'void_sale', q.qty, p.stock_quantity, p.stock_quantity + q.qty, p_sale_id, v_reason, v_uid
  from (
    select si.product_id, sum(si.quantity)::integer as qty
    from public.sale_items si
    where si.sale_id = p_sale_id and si.product_id is not null
    group by si.product_id
  ) q
  join public.products p on p.id = q.product_id;

  update public.products p
     set stock_quantity = p.stock_quantity + q.qty
    from (
      select si.product_id, sum(si.quantity)::integer as qty
      from public.sale_items si
      where si.sale_id = p_sale_id and si.product_id is not null
      group by si.product_id
    ) q
   where p.id = q.product_id;

  update public.sales
     set status = 'voided', voided_at = now(), voided_by = v_uid, void_reason = v_reason
   where id = p_sale_id
  returning * into v_sale;

  return v_sale;
end;
$$;

revoke all on function public.record_stock_movement(uuid, text, integer, text) from public, anon;
revoke all on function public.create_sale(uuid, jsonb, text, numeric, numeric, text) from public, anon;
revoke all on function public.void_sale(uuid, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, integer, text) to authenticated;
grant execute on function public.create_sale(uuid, jsonb, text, numeric, numeric, text) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
