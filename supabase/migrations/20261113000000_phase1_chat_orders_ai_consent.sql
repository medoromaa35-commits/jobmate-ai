-- Phase 1: AI-processing consent, order requests (pricing/payment), chatbot rate limiting.

-- ---------------------------------------------------------------------------
-- 1) New REQUIRED consent: AI-assisted processing
-- ---------------------------------------------------------------------------
alter table public.consents drop constraint if exists consents_consent_key_check;
alter table public.consents add constraint consents_consent_key_check check (consent_key in
  ('process_profile','ai_processing','cross_border','contact_email',
   'contact_whatsapp','anonymized_improvement','marketing'));

create or replace function public.submit_application(payload jsonb, consents jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id        uuid := (payload ->> 'id')::uuid;
  v_cv_path   text := payload ->> 'cv_path';
  v_status    text;
  v_remaining int;
  v_required  text[] := array['process_profile','ai_processing','cross_border','contact_email'];
  v_key       text;
  c           jsonb;
begin
  if coalesce(payload ->> 'website', '') <> '' then
    raise exception 'rejected' using errcode = 'P0001';
  end if;

  foreach v_key in array v_required loop
    if not exists (
      select 1 from jsonb_array_elements(consents) e
      where e ->> 'key' = v_key and (e ->> 'granted')::boolean is true
    ) then
      raise exception 'missing_required_consent:%', v_key using errcode = 'P0001';
    end if;
  end loop;

  if v_cv_path is null or split_part(v_cv_path, '/', 1) <> v_id::text then
    raise exception 'invalid_cv_path' using errcode = 'P0001';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'cvs' and name = v_cv_path) then
    raise exception 'cv_not_found' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.applicants where lower(email) = lower(payload ->> 'email')) then
    raise exception 'duplicate_email' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('jobmate_pilot_seats'));
  select remaining into v_remaining from public.pilot_seats();
  v_status := case when v_remaining > 0 then 'new' else 'waitlist' end;

  insert into public.applicants (
    id, status, language, full_name, email, mobile,
    current_job_title, years_experience, current_industry,
    target_roles, preferred_locations, preferred_location_other,
    max_commute_minutes, work_modes, min_salary_range,
    cv_path, linkedin_url, applications_last_month,
    willing_to_pay, fair_price_egp, heard_from, heard_from_other, price_shown_egp
  ) values (
    v_id, v_status, coalesce(payload ->> 'language', 'ar'),
    btrim(payload ->> 'full_name'), lower(btrim(payload ->> 'email')), payload ->> 'mobile',
    btrim(payload ->> 'current_job_title'), (payload ->> 'years_experience')::int, btrim(payload ->> 'current_industry'),
    array(select jsonb_array_elements_text(payload -> 'target_roles')),
    array(select jsonb_array_elements_text(payload -> 'preferred_locations')),
    nullif(btrim(payload ->> 'preferred_location_other'), ''),
    (payload ->> 'max_commute_minutes')::int,
    array(select jsonb_array_elements_text(payload -> 'work_modes')),
    payload ->> 'min_salary_range',
    v_cv_path, nullif(btrim(payload ->> 'linkedin_url'), ''),
    payload ->> 'applications_last_month',
    payload ->> 'willing_to_pay', nullif(payload ->> 'fair_price_egp', '')::int,
    payload ->> 'heard_from', nullif(btrim(payload ->> 'heard_from_other'), ''),
    payload ->> 'price_shown_egp'
  );

  for c in select * from jsonb_array_elements(consents) loop
    insert into public.consents (applicant_id, consent_key, granted, required,
                                 consent_version, consent_text, language, granted_at)
    values (v_id, c ->> 'key', (c ->> 'granted')::boolean,
            (c ->> 'key') = any (v_required),
            c ->> 'version', c ->> 'text', coalesce(c ->> 'language', 'ar'),
            coalesce((c ->> 'granted_at')::timestamptz, now()));
  end loop;

  return jsonb_build_object('id', v_id, 'status', v_status);
end;
$$;
revoke all on function public.submit_application(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_application(jsonb, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Orders (payment requests). Public can INSERT a pending order only.
--    When a payment provider (Paymob/Kashier) is connected, a server function
--    will create the checkout and update status via webhook.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  plan          text not null check (plan in ('pilot_sprint')),
  price_shown   text,                         -- the price constant the buyer saw
  amount_egp    int check (amount_egp is null or amount_egp between 0 and 1000000),
  full_name     text not null check (char_length(full_name) between 2 and 120),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  mobile        text not null check (mobile ~ '^\+201[0125][0-9]{8}$'),
  language      text not null default 'ar' check (language in ('ar','en')),
  status        text not null default 'pending' check (status in ('pending','link_sent','paid','cancelled','refunded')),
  provider      text,
  provider_ref  text,
  admin_note    text check (char_length(admin_note) <= 2000)
);
create index if not exists orders_created_idx on public.orders (created_at desc);

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant insert (plan, price_shown, full_name, email, mobile, language) on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;

drop policy if exists orders_public_insert on public.orders;
create policy orders_public_insert on public.orders for insert to anon, authenticated
  with check (status = 'pending' and provider is null and provider_ref is null and amount_egp is null);
drop policy if exists orders_admin_select on public.orders;
create policy orders_admin_select on public.orders for select to authenticated using (public.is_admin());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3) Chatbot rate limiting. Only salted hashes of the client IP are stored,
--    bucketed per hour, and rows older than 2 days are purged on each call.
--    Callable only by the Edge Function (service_role).
-- ---------------------------------------------------------------------------
create table if not exists public.chat_usage (
  key_hash     text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (key_hash, window_start)
);
alter table public.chat_usage enable row level security;
revoke all on public.chat_usage from anon, authenticated;

create or replace function public.chat_rate_check(p_key_hash text, p_per_hour int, p_global_per_day int)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_hour  timestamptz := date_trunc('hour', now());
  v_count int;
  v_day   int;
begin
  delete from public.chat_usage where window_start < now() - interval '2 days';

  select coalesce(sum(count), 0) into v_day from public.chat_usage
   where key_hash = '__global__' and window_start >= date_trunc('day', now());
  if v_day >= p_global_per_day then
    return false;
  end if;

  insert into public.chat_usage (key_hash, window_start, count) values (p_key_hash, v_hour, 1)
  on conflict (key_hash, window_start) do update set count = public.chat_usage.count + 1
  returning count into v_count;
  if v_count > p_per_hour then
    return false;
  end if;

  insert into public.chat_usage (key_hash, window_start, count) values ('__global__', v_hour, 1)
  on conflict (key_hash, window_start) do update set count = public.chat_usage.count + 1;
  return true;
end;
$$;
revoke all on function public.chat_rate_check(text, int, int) from public, anon, authenticated;
grant execute on function public.chat_rate_check(text, int, int) to service_role;

-- Count the new public page
create or replace function public.track_page_view(p_path text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_path not in ('/', '/consent', '/apply', '/thank-you', '/delete-my-data', '/privacy', '/terms', '/pricing', '/checkout') then
    return;
  end if;
  insert into public.page_views (path, day, count) values (p_path, current_date, 1)
  on conflict (path, day) do update set count = public.page_views.count + 1;
end;
$$;
