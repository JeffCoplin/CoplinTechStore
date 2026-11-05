import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite, type Transaction } from '@electric-sql/pglite'

/**
 * Base de datos PostgreSQL embebida (PGlite) con un stub mínimo de Supabase
 * (roles anon/authenticated, auth.uid(), storage y realtime.send) sobre la que
 * se aplican las migraciones reales de supabase/migrations.
 *
 * Limitación: PGlite es de una sola conexión, por lo que la concurrencia real
 * se prueba aparte en concurrency.test.ts contra Supabase local (DATABASE_URL).
 */

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

create schema realtime;
create table realtime.sent (payload jsonb, event text, topic text, private boolean);
create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$ insert into realtime.sent values (payload, event, topic, private) $$;

grant usage on schema public to anon, authenticated;
-- Igual que Supabase: privilegios amplios por defecto que las migraciones deben revocar.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'supabase', 'migrations')

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return db
}

export const OWNER = '11111111-1111-4111-8111-111111111111'
export const STRANGER = '22222222-2222-4222-8222-222222222222'

export async function seedUsers(db: PGlite): Promise<void> {
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@test.local'),
      ('${STRANGER}', 'stranger@test.local');
    insert into public.owner_profiles (user_id, display_name) values ('${OWNER}', 'Propietario de prueba');
  `)
}

export type Actor = 'anon' | 'owner' | 'stranger'

/** Ejecuta fn dentro de una transacción con el rol y el JWT simulados. */
export async function as<T>(db: PGlite, actor: Actor, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (actor === 'anon') {
      await tx.exec(`set local role anon; select set_config('request.jwt.claim.sub', '', true);`)
    } else {
      const id = actor === 'owner' ? OWNER : STRANGER
      await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${id}', true);`)
    }
    return fn(tx)
  })
}

/** Ejecuta y devuelve el error de PostgreSQL (o null si no falló). */
export async function pgError(promise: Promise<unknown>): Promise<{ code?: string; message: string; hint?: string } | null> {
  try {
    await promise
    return null
  } catch (e) {
    return e as { code?: string; message: string; hint?: string }
  }
}
