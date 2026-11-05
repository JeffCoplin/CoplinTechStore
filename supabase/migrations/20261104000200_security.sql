-- CoplinTech · Seguridad: propietario, RLS y permisos
-- Principio: anon no lee ninguna tabla; el propietario activo opera vía RLS
-- y las operaciones críticas (stock, ventas) solo vía funciones transaccionales.

-- ---------------------------------------------------------------------------
-- Helpers de identidad
-- ---------------------------------------------------------------------------

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_profiles op
    where op.user_id = auth.uid()
      and op.is_active
  );
$$;

-- Lanza error si quien llama no es el propietario activo. Usada por las RPC.
create or replace function public.assert_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_owner() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

revoke all on function public.is_owner() from public, anon;
revoke all on function public.assert_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.assert_owner() to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_mutation() from public, anon, authenticated;
revoke all on function public.guard_voided_expense() from public, anon, authenticated;
revoke all on function public.availability_status(integer, integer) from public, anon;
grant execute on function public.availability_status(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Permisos base: quitar todo lo que Supabase concede por defecto
-- ---------------------------------------------------------------------------

revoke all on table
  public.owner_profiles, public.store_settings, public.categories, public.products,
  public.sales, public.sale_items, public.stock_movements, public.expenses
from public, anon, authenticated;

revoke all on sequence public.sale_number_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS en todas las tablas privadas
-- ---------------------------------------------------------------------------

alter table public.owner_profiles  enable row level security;
alter table public.store_settings  enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses        enable row level security;

-- owner_profiles: cada usuario solo puede ver su propio perfil (para que el
-- guard sepa si es propietario). Sin escritura desde el cliente.
grant select on public.owner_profiles to authenticated;
create policy owner_profiles_select_self on public.owner_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- store_settings: lectura/edición solo propietario. El público usa get_public_store_info().
grant select on public.store_settings to authenticated;
grant update (store_name, whatsapp_number, default_low_stock_threshold) on public.store_settings to authenticated;
create policy store_settings_owner_select on public.store_settings
  for select to authenticated using ((select public.is_owner()));
create policy store_settings_owner_update on public.store_settings
  for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- categories: CRUD propietario (el borrado lo impide la FK si tiene productos).
grant select, delete on public.categories to authenticated;
grant insert (name, slug, sort_order, is_active) on public.categories to authenticated;
grant update (name, slug, sort_order, is_active) on public.categories to authenticated;
create policy categories_owner_all on public.categories
  for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- products: el propietario lee e inserta; al editar NO puede tocar stock_quantity
-- (privilegio por columna). Sin DELETE: los productos se desactivan.
grant select on public.products to authenticated;
grant insert (name, slug, sku, barcode, brand, category_id, description, cost_price, sale_price,
              stock_quantity, low_stock_threshold, image_path, is_active, is_published)
  on public.products to authenticated;
grant update (name, slug, sku, barcode, brand, category_id, description, cost_price, sale_price,
              low_stock_threshold, image_path, is_active, is_published)
  on public.products to authenticated;
create policy products_owner_select on public.products
  for select to authenticated using ((select public.is_owner()));
create policy products_owner_insert on public.products
  for insert to authenticated with check ((select public.is_owner()));
create policy products_owner_update on public.products
  for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- sales / sale_items / stock_movements: solo lectura del propietario.
-- Escritura exclusiva vía create_sale, void_sale y record_stock_movement.
grant select on public.sales, public.sale_items, public.stock_movements to authenticated;
create policy sales_owner_select on public.sales
  for select to authenticated using ((select public.is_owner()));
create policy sale_items_owner_select on public.sale_items
  for select to authenticated using ((select public.is_owner()));
create policy stock_movements_owner_select on public.stock_movements
  for select to authenticated using ((select public.is_owner()));

-- expenses: propietario crea, lee y edita; "anular" = is_voided. Sin DELETE.
grant select on public.expenses to authenticated;
grant insert (expense_date, category, description, amount, payment_method, note) on public.expenses to authenticated;
grant update (expense_date, category, description, amount, payment_method, note, is_voided) on public.expenses to authenticated;
create policy expenses_owner_select on public.expenses
  for select to authenticated using ((select public.is_owner()));
create policy expenses_owner_insert on public.expenses
  for insert to authenticated
  with check ((select public.is_owner()) and created_by = (select auth.uid()));
create policy expenses_owner_update on public.expenses
  for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- Stock inicial: al crear un producto con existencia > 0 se registra el
-- movimiento initial_stock en la misma transacción.
-- ---------------------------------------------------------------------------

create or replace function public.products_initial_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock_quantity > 0 then
    insert into public.stock_movements
      (product_id, movement_type, quantity_delta, quantity_before, quantity_after, reason, created_by)
    values
      (new.id, 'initial_stock', new.stock_quantity, 0, new.stock_quantity, 'Existencia inicial', public.assert_owner());
  end if;
  return new;
end;
$$;

revoke all on function public.products_initial_stock() from public, anon, authenticated;

create trigger products_initial_stock
  after insert on public.products
  for each row execute function public.products_initial_stock();
