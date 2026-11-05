-- CoplinTech · Esquema base
-- Tablas, restricciones e índices. La seguridad (RLS, permisos) está en la migración siguiente.
-- gen_random_uuid() y hashtextextended() son nativas de PostgreSQL 13+: no se requieren extensiones.

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- owner_profiles: única cuenta propietaria (alta manual, sin registro público)
-- ---------------------------------------------------------------------------

create table public.owner_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Una sola cuenta propietaria activa.
create unique index owner_profiles_single_active_idx
  on public.owner_profiles ((true)) where is_active;

create trigger owner_profiles_updated_at
  before update on public.owner_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- store_settings: fila única
-- ---------------------------------------------------------------------------

create table public.store_settings (
  id                          boolean primary key default true check (id = true),
  store_name                  text not null default 'CoplinTech'
                                check (char_length(btrim(store_name)) between 1 and 120),
  whatsapp_number             text null
                                check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{8,15}$'),
  currency_code               text not null default 'DOP' check (currency_code = 'DOP'),
  timezone                    text not null default 'America/Santo_Domingo'
                                check (timezone = 'America/Santo_Domingo'),
  default_low_stock_threshold integer not null default 2 check (default_low_stock_threshold >= 0),
  updated_at                  timestamptz not null default now()
);

insert into public.store_settings (id) values (true);

create trigger store_settings_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_sort_idx on public.categories (sort_order, name);

create trigger categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(btrim(name)) between 1 and 160),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku                 text null unique check (sku is null or char_length(btrim(sku)) between 1 and 64),
  barcode             text null unique check (barcode is null or char_length(btrim(barcode)) between 1 and 64),
  brand               text null check (brand is null or char_length(brand) <= 80),
  category_id         uuid null references public.categories (id) on delete restrict,
  description         text null check (description is null or char_length(description) <= 5000),
  cost_price          numeric(12,2) not null check (cost_price >= 0),
  sale_price          numeric(12,2) not null check (sale_price > 0),
  stock_quantity      integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 2 check (low_stock_threshold >= 0),
  image_path          text null check (image_path is null or image_path ~ '^products/[A-Za-z0-9._/-]+$'),
  is_active           boolean not null default true,
  is_published        boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_active_published_idx on public.products (is_active, is_published);
create index products_name_idx on public.products (lower(name));

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Estado de disponibilidad derivado: única lógica compartida.
create or replace function public.availability_status(p_stock integer, p_threshold integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_stock <= 0 then 'out_of_stock'
    when p_stock <= p_threshold then 'low_stock'
    else 'available'
  end;
$$;

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------

create sequence public.sale_number_seq as bigint start 1;

create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  sale_number       text not null unique,
  status            text not null default 'completed' check (status in ('completed', 'voided')),
  payment_method    text not null check (payment_method in ('cash', 'bank_transfer', 'card')),
  subtotal          numeric(12,2) not null check (subtotal >= 0),
  discount_amount   numeric(12,2) not null default 0 check (discount_amount >= 0),
  total             numeric(12,2) not null check (total >= 0),
  amount_received   numeric(12,2) not null check (amount_received >= 0),
  change_amount     numeric(12,2) not null default 0 check (change_amount >= 0),
  note              text null check (note is null or char_length(note) <= 500),
  client_request_id uuid not null unique,
  created_by        uuid not null references auth.users (id),
  created_at        timestamptz not null default now(),
  voided_at         timestamptz null,
  voided_by         uuid null references auth.users (id),
  void_reason       text null,
  constraint sales_discount_le_subtotal check (discount_amount <= subtotal),
  constraint sales_total_consistent check (total = subtotal - discount_amount),
  constraint sales_void_consistent check (
    (status = 'completed' and voided_at is null and voided_by is null and void_reason is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null
        and char_length(btrim(void_reason)) > 0)
  )
);

create index sales_created_at_idx on public.sales (created_at desc);
create index sales_status_created_at_idx on public.sales (status, created_at desc);
create index sales_sale_number_idx on public.sales (sale_number);

-- ---------------------------------------------------------------------------
-- sale_items (snapshots históricos)
-- ---------------------------------------------------------------------------

create table public.sale_items (
  id                    uuid primary key default gen_random_uuid(),
  sale_id               uuid not null references public.sales (id) on delete restrict,
  product_id            uuid null references public.products (id) on delete restrict,
  product_name_snapshot text not null,
  sku_snapshot          text null,
  quantity              integer not null check (quantity > 0),
  unit_sale_price       numeric(12,2) not null check (unit_sale_price >= 0),
  unit_cost_price       numeric(12,2) not null check (unit_cost_price >= 0),
  line_subtotal         numeric(12,2) not null check (line_subtotal >= 0)
);

create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- ---------------------------------------------------------------------------
-- stock_movements (inmutables)
-- ---------------------------------------------------------------------------

create table public.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete restrict,
  movement_type   text not null
                    check (movement_type in ('initial_stock', 'restock', 'adjustment', 'sale', 'void_sale')),
  quantity_delta  integer not null check (quantity_delta <> 0),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after  integer not null check (quantity_after >= 0),
  sale_id         uuid null references public.sales (id) on delete restrict,
  reason          text null,
  created_by      uuid not null references auth.users (id),
  created_at      timestamptz not null default now(),
  constraint stock_movements_math check (quantity_after = quantity_before + quantity_delta),
  constraint stock_movements_sale_link check (
    (movement_type in ('sale', 'void_sale')) = (sale_id is not null)
  ),
  constraint stock_movements_adjustment_reason check (
    movement_type <> 'adjustment' or char_length(btrim(coalesce(reason, ''))) > 0
  )
);

create index stock_movements_product_created_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_created_idx on public.stock_movements (created_at desc);
create index stock_movements_sale_idx on public.stock_movements (sale_id);

-- Los movimientos no se modifican ni se borran (ni siquiera por el propietario).
create or replace function public.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los registros de % son inmutables', tg_table_name
    using errcode = 'P0001';
end;
$$;

create trigger stock_movements_immutable
  before update or delete on public.stock_movements
  for each row execute function public.prevent_mutation();

create trigger sale_items_immutable
  before update or delete on public.sale_items
  for each row execute function public.prevent_mutation();

-- Las ventas nunca se borran (la anulación es un cambio de estado).
create trigger sales_no_delete
  before delete on public.sales
  for each row execute function public.prevent_mutation();

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  expense_date   date not null,
  category       text not null
                   check (category in ('advertising', 'transport', 'packaging', 'services', 'rent', 'supplies', 'other')),
  description    text not null check (char_length(btrim(description)) between 1 and 200),
  amount         numeric(12,2) not null check (amount > 0),
  payment_method text null check (payment_method is null or payment_method in ('cash', 'bank_transfer', 'card')),
  note           text null check (note is null or char_length(note) <= 500),
  is_voided      boolean not null default false,
  created_by     uuid not null default auth.uid() references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index expenses_date_idx on public.expenses (expense_date desc);

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- Un gasto anulado no puede editarse ni "desanularse".
create or replace function public.guard_voided_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_voided then
    raise exception 'Un gasto anulado no puede modificarse' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger expenses_guard_voided
  before update on public.expenses
  for each row execute function public.guard_voided_expense();

create trigger expenses_no_delete
  before delete on public.expenses
  for each row execute function public.prevent_mutation();
