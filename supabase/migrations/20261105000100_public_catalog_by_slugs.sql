-- CoplinTech · Carrito de consulta por WhatsApp
-- RPC pública para refrescar los productos guardados en el carrito del visitante
-- (precio y disponibilidad actuales). Misma proyección segura que el catálogo:
-- nunca devuelve costos, cantidades exactas ni umbrales. Solo lectura.

create or replace function public.get_public_catalog_products_by_slugs(p_slugs text[])
returns table (
  name          text,
  slug          text,
  brand         text,
  category_name text,
  sale_price    numeric,
  image_path    text,
  availability  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, p.slug, p.brand, c.name, p.sale_price, p.image_path,
         public.availability_status(p.stock_quantity, p.low_stock_threshold)
  from public.products p
  left join public.categories c on c.id = p.category_id and c.is_active
  where p.slug = any (p_slugs[1:50])
    and p.is_active
    and p.is_published
    and (p.category_id is null or c.id is not null);
$$;

revoke all on function public.get_public_catalog_products_by_slugs(text[]) from public;
grant execute on function public.get_public_catalog_products_by_slugs(text[]) to anon, authenticated;
