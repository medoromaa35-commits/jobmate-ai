-- Minimal stand-in for the Supabase platform, ONLY for local testing of the migration.
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, created_at timestamptz default now(), unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to anon, authenticated;
