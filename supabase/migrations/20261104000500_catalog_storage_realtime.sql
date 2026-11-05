-- CoplinTech · Catálogo público, Storage de imágenes y Realtime saneado

-- ---------------------------------------------------------------------------
-- RPC públicas del catálogo: proyectan SOLO campos permitidos.
-- Nunca devuelven cost_price, stock_quantity, low_stock_threshold ni datos internos.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_catalog_products(
  p_search        text default null,
  p_category_slug text default null,
  p_limit         integer default 24,
  p_offset        integer default 0
)
returns table (
  name          text,
  slug          text,
  brand         text,
  category_name text,
  category_slug text,
  description   text,
  sale_price    numeric,
  image_path    text,
  availability  text,
  total_count   bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtered as (
    select p.name, p.slug, p.brand, c.name as category_name, c.slug as category_slug,
           p.description, p.sale_price, p.image_path,
           public.availability_status(p.stock_quantity, p.low_stock_threshold) as availability
    from public.products p
    left join public.categories c on c.id = p.category_id and c.is_active
    where p.is_active
      and p.is_published
      and (p.category_id is null or c.id is not null)
      and (nullif(btrim(p_category_slug), '') is null or c.slug = btrim(p_category_slug))
      and (
        nullif(btrim(p_search), '') is null
        or p.name ilike '%' || replace(replace(replace(btrim(left(p_search, 80)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or p.brand ilike '%' || replace(replace(replace(btrim(left(p_search, 80)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      )
  )
  select f.*, count(*) over () as total_count
  from filtered f
  order by case f.availability when 'out_of_stock' then 1 else 0 end, f.name
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_public_catalog_product_by_slug(p_slug text)
returns table (
  name          text,
  slug          text,
  brand         text,
  category_name text,
  category_slug text,
  description   text,
  sale_price    numeric,
  image_path    text,
  availability  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, p.slug, p.brand, c.name, c.slug, p.description, p.sale_price, p.image_path,
         public.availability_status(p.stock_quantity, p.low_stock_threshold)
  from public.products p
  left join public.categories c on c.id = p.category_id and c.is_active
  where p.slug = p_slug
    and p.is_active
    and p.is_published
    and (p.category_id is null or c.id is not null)
  limit 1;
$$;

-- Categorías activas que tienen al menos un producto publicado.
create or replace function public.get_public_categories()
returns table (name text, slug text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, c.slug
  from public.categories c
  where c.is_active
    and exists (
      select 1 from public.products p
      where p.category_id = c.id and p.is_active and p.is_published
    )
  order by c.sort_order, c.name;
$$;

-- Datos públicos de la tienda (sin campos internos).
create or replace function public.get_public_store_info()
returns table (store_name text, whatsapp_number text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.store_name, s.whatsapp_number from public.store_settings s where s.id = true;
$$;

revoke all on function public.get_public_catalog_products(text, text, integer, integer) from public;
revoke all on function public.get_public_catalog_product_by_slug(text) from public;
revoke all on function public.get_public_categories() from public;
revoke all on function public.get_public_store_info() from public;
grant execute on function public.get_public_catalog_products(text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_public_catalog_product_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_categories() to anon, authenticated;
grant execute on function public.get_public_store_info() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket de imágenes de productos
-- Lectura pública por URL directa (rutas UUID no listables); escritura solo propietario.
-- Tamaño y tipos MIME validados por el propio bucket.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_owner()));

create policy product_images_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (select public.is_owner())
    and name ~ '^products/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  );

create policy product_images_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_owner()))
  with check (
    bucket_id = 'product-images'
    and (select public.is_owner())
    and name ~ '^products/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  );

create policy product_images_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_owner()));

-- ---------------------------------------------------------------------------
-- Realtime Broadcast saneado
-- Solo se emite {product_slug?, kind}. Nunca filas completas ni cantidades.
-- El cliente vuelve a consultar las RPC públicas al recibir el evento.
-- ---------------------------------------------------------------------------

create or replace function public.broadcast_catalog_change(p_kind text, p_slug text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('kind', p_kind, 'slug', p_slug),
      'catalog_changed',
      'catalog',
      false
    );
  exception when others then
    -- Realtime no debe romper ventas ni ediciones: el catálogo tiene revalidación de respaldo.
    null;
  end;
end;
$$;

revoke all on function public.broadcast_catalog_change(text, text) from public, anon, authenticated;

create or replace function public.products_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_visible boolean := false;
  v_is_visible  boolean := false;
  v_changed     boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_was_visible := old.is_active and old.is_published;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_is_visible := new.is_active and new.is_published;
  end if;

  if not (v_was_visible or v_is_visible) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    v_changed := v_was_visible is distinct from v_is_visible
      or old.name is distinct from new.name
      or old.slug is distinct from new.slug
      or old.brand is distinct from new.brand
      or old.category_id is distinct from new.category_id
      or old.description is distinct from new.description
      or old.sale_price is distinct from new.sale_price
      or old.image_path is distinct from new.image_path
      or public.availability_status(old.stock_quantity, old.low_stock_threshold)
         is distinct from public.availability_status(new.stock_quantity, new.low_stock_threshold);
  else
    v_changed := true;
  end if;

  if v_changed then
    perform public.broadcast_catalog_change(
      'product',
      case when tg_op = 'DELETE' then old.slug else new.slug end
    );
  end if;
  return null;
end;
$$;

create or replace function public.catalog_meta_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.broadcast_catalog_change(case tg_table_name when 'categories' then 'category' else 'store' end, null);
  return null;
end;
$$;

revoke all on function public.products_broadcast_change() from public, anon, authenticated;
revoke all on function public.catalog_meta_broadcast_change() from public, anon, authenticated;

create trigger products_broadcast_change
  after insert or update or delete on public.products
  for each row execute function public.products_broadcast_change();

create trigger categories_broadcast_change
  after insert or update or delete on public.categories
  for each statement execute function public.catalog_meta_broadcast_change();

create trigger store_settings_broadcast_change
  after update on public.store_settings
  for each statement execute function public.catalog_meta_broadcast_change();
