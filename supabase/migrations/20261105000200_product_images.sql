-- CoplinTech · Varias imágenes por producto
-- product_images guarda la galería ordenada. La primera imagen es la principal y
-- se copia automáticamente a products.image_path, así el catálogo, el carrito y
-- el panel siguen usando una sola columna para la miniatura.

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_path text not null unique check (image_path ~ '^products/[A-Za-z0-9._/-]+$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order, created_at);

-- Imágenes existentes → primera imagen de cada galería.
insert into public.product_images (product_id, image_path, sort_order)
select id, image_path, 0 from public.products where image_path is not null;

-- ---------------------------------------------------------------------------
-- Seguridad: solo el propietario. El público ve la galería por RPC.
-- ---------------------------------------------------------------------------

revoke all on table public.product_images from public, anon, authenticated;
alter table public.product_images enable row level security;
grant select on public.product_images to authenticated;
create policy product_images_owner_select on public.product_images
  for select to authenticated using ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- Mantener products.image_path = primera imagen de la galería
-- ---------------------------------------------------------------------------

create or replace function public.sync_product_main_image(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first text;
begin
  select pi.image_path into v_first
  from public.product_images pi
  where pi.product_id = p_product_id
  order by pi.sort_order, pi.created_at, pi.id
  limit 1;

  update public.products p
     set image_path = v_first
   where p.id = p_product_id
     and p.image_path is distinct from v_first;
end;
$$;

revoke all on function public.sync_product_main_image(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_product_images: reemplaza la galería completa en una transacción.
--   p_paths: rutas en el orden deseado (la primera es la principal), máx. 8.
--   Devuelve las rutas que dejaron de usarse para borrarlas de Storage.
-- ---------------------------------------------------------------------------

create or replace function public.set_product_images(p_product_id uuid, p_paths text[])
returns table (removed_path text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_paths text[] := coalesce(p_paths, array[]::text[]);
  v_slug  text;
  v_visible boolean;
begin
  perform public.assert_owner();

  select p.slug, p.is_active and p.is_published into v_slug, v_visible
  from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'Producto no encontrado' using errcode = 'P0002';
  end if;

  if cardinality(v_paths) > 8 then
    raise exception 'Máximo 8 imágenes por producto' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_paths) u(path) where u.path is null or u.path !~ '^products/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'Ruta de imagen inválida' using errcode = '22023';
  end if;
  if (select count(distinct u.path) from unnest(v_paths) u(path)) <> cardinality(v_paths) then
    raise exception 'Hay imágenes repetidas' using errcode = '22023';
  end if;
  -- Una imagen no puede pertenecer a otro producto.
  if exists (
    select 1 from public.product_images pi
    where pi.image_path = any (v_paths) and pi.product_id <> p_product_id
  ) then
    raise exception 'Una de las imágenes pertenece a otro producto' using errcode = '22023';
  end if;

  return query
  with removed as (
    delete from public.product_images pi
    where pi.product_id = p_product_id and not (pi.image_path = any (v_paths))
    returning pi.image_path
  )
  select r.image_path from removed r;

  insert into public.product_images (product_id, image_path, sort_order)
  select p_product_id, u.path, (u.ord - 1)::int
  from unnest(v_paths) with ordinality as u(path, ord)
  on conflict (image_path) do update set sort_order = excluded.sort_order;

  perform public.sync_product_main_image(p_product_id);

  -- Cambios en la galería de un producto visible → aviso saneado al catálogo.
  if v_visible then
    perform public.broadcast_catalog_change('product', v_slug);
  end if;
end;
$$;

revoke all on function public.set_product_images(uuid, text[]) from public, anon;
grant execute on function public.set_product_images(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Detalle público: añade la galería (solo rutas de imagen, en orden).
-- Se recrea porque cambia el tipo de retorno.
-- ---------------------------------------------------------------------------

drop function public.get_public_catalog_product_by_slug(text);

create function public.get_public_catalog_product_by_slug(p_slug text)
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
  images        text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, p.slug, p.brand, c.name, c.slug, p.description, p.sale_price, p.image_path,
         public.availability_status(p.stock_quantity, p.low_stock_threshold),
         coalesce(
           (select array_agg(pi.image_path order by pi.sort_order, pi.created_at, pi.id)
              from public.product_images pi where pi.product_id = p.id),
           case when p.image_path is null then array[]::text[] else array[p.image_path] end
         )
  from public.products p
  left join public.categories c on c.id = p.category_id and c.is_active
  where p.slug = p_slug
    and p.is_active
    and p.is_published
    and (p.category_id is null or c.id is not null)
  limit 1;
$$;

revoke all on function public.get_public_catalog_product_by_slug(text) from public;
grant execute on function public.get_public_catalog_product_by_slug(text) to anon, authenticated;
