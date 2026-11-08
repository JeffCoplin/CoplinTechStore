-- CoplinTech · Videos en la galería del producto
-- product_images ahora guarda imágenes y videos (máx. 2 videos dentro de las 8 piezas).
-- - Los videos van siempre primero en la galería pública.
-- - products.image_path (miniatura del catálogo y del carrito) es la primera IMAGEN,
--   nunca un video.
-- - El bucket acepta MP4, WebM y MOV hasta 50 MB (límite de subida del plan gratuito).
--   El tamaño de las imágenes lo sigue limitando el panel (5 MB tras optimizar).

create or replace function public.is_video_path(p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path ~* '\.(mp4|webm|mov)$';
$$;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
 where id = 'product-images';

drop policy product_images_owner_insert on storage.objects;
drop policy product_images_owner_update on storage.objects;

create policy product_images_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (select public.is_owner())
    and name ~ '^products/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm|mov)$'
  );

create policy product_images_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_owner()))
  with check (
    bucket_id = 'product-images'
    and (select public.is_owner())
    and name ~ '^products/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm|mov)$'
  );

-- ---------------------------------------------------------------------------
-- Miniatura = primera imagen (los videos se saltan)
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
    and not public.is_video_path(pi.image_path)
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
-- set_product_images: acepta videos; los guarda antes que las imágenes.
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
    raise exception 'Máximo 8 imágenes y videos por producto' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_paths) u(path) where u.path is null or u.path !~ '^products/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm|mov)$') then
    raise exception 'Ruta de imagen o video inválida' using errcode = '22023';
  end if;
  if (select count(*) from unnest(v_paths) u(path) where public.is_video_path(u.path)) > 2 then
    raise exception 'Máximo 2 videos por producto' using errcode = '22023';
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

  -- Videos primero, conservando el orden relativo de cada grupo.
  insert into public.product_images (product_id, image_path, sort_order)
  select p_product_id, u.path,
         (row_number() over (order by public.is_video_path(u.path) desc, u.ord) - 1)::int
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
-- Detalle público: galería con videos primero.
-- ---------------------------------------------------------------------------

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
           (select array_agg(pi.image_path order by public.is_video_path(pi.image_path) desc, pi.sort_order, pi.created_at, pi.id)
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
