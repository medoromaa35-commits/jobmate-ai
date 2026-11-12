-- Any auth user whose email is in private.admin_emails automatically gets app_metadata.role = 'admin'.
-- To add another admin: insert into private.admin_emails values ('someone@example.com');
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.admin_emails (email text primary key);
insert into private.admin_emails (email) values ('medo.romaa35@gmail.com') on conflict do nothing;

create or replace function private.grant_admin_role()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
begin
  if exists (select 1 from private.admin_emails where email = lower(new.email)) then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists grant_admin_role on auth.users;
create trigger grant_admin_role before insert or update of email on auth.users
for each row execute function private.grant_admin_role();

update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) in (select email from private.admin_emails);
