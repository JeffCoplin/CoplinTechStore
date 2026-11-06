-- CoplinTech · Orden del catálogo público
-- get_public_catalog_products acepta p_sort: null (por nombre), 'price_asc',
-- 'price_desc' o 'newest'. En todos los casos los agotados van al final.
-- Valores desconocidos se tratan como null.

drop function public.get_public_catalog_products(text, text, integer, integer);

create function public.get_public_catalog_products(
  p_search        text default null,
  p_category_slug text default null,
  p_limit         integer default 24,
  p_offset        integer default 0,
  p_sort          text default null
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
           public.availability_status(p.stock_quantity, p.low_stock_threshold) as availability,
           p.created_at
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
  select f.name, f.slug, f.brand, f.category_name, f.category_slug, f.description,
         f.sale_price, f.image_path, f.availability, count(*) over () as total_count
  from filtered f
  order by case f.availability when 'out_of_stock' then 1 else 0 end,
           case when p_sort = 'price_asc' then f.sale_price end asc nulls last,
           case when p_sort = 'price_desc' then f.sale_price end desc nulls last,
           case when p_sort = 'newest' then f.created_at end desc nulls last,
           f.name
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_public_catalog_products(text, text, integer, integer, text) from public;
grant execute on function public.get_public_catalog_products(text, text, integer, integer, text) to anon, authenticated;
