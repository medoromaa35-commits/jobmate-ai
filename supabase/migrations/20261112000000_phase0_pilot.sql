-- JobMate AI — Phase 0 (concierge pilot) schema
-- Tables: applicants, consents, deletion_requests, admin_notes (+ page_views for privacy-friendly counts)
-- Principles:
--   * RLS on every table. The public (anon) role can only INSERT its own submission;
--     it can never read, update or delete anything.
--   * Applications go through submit_application(), a SECURITY DEFINER function that
--     validates required consents, assigns seat/waitlist status atomically and writes
--     applicant + consents in one transaction.
--   * Admin = authenticated user whose app_metadata.role = 'admin'
--     (app_metadata can only be set with the service role, never by the user).
--   * We deliberately do NOT store national ID, date of birth, gender, religion,
--     marital status or photo. There are no columns for them.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists public.pilot_settings (
  id          boolean primary key default true check (id),  -- single row
  total_seats int not null default 30 check (total_seats >= 0)
);
insert into public.pilot_settings (id, total_seats) values (true, 30)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- ---------------------------------------------------------------------------
-- applicants
-- ---------------------------------------------------------------------------
create table if not exists public.applicants (
  id                        uuid primary key,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  status                    text not null default 'new'
                            check (status in ('new','accepted','waitlist','rejected','active','done')),
  language                  text not null default 'ar' check (language in ('ar','en')),

  full_name                 text not null check (char_length(full_name) between 2 and 120),
  email                     text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  mobile                    text not null check (mobile ~ '^\+201[0125][0-9]{8}$'),

  current_job_title         text not null check (char_length(current_job_title) between 2 and 120),
  years_experience          int  not null check (years_experience between 0 and 50),
  current_industry          text not null check (char_length(current_industry) between 2 and 120),

  target_roles              text[] not null check (cardinality(target_roles) >= 1 and target_roles <@ array[
                              'hr_generalist','hr_operations','recruitment_ta','comp_ben','payroll',
                              'training_development','od','hrbp','hr_manager']::text[]),
  preferred_locations       text[] not null check (cardinality(preferred_locations) >= 1 and preferred_locations <@ array[
                              'new_cairo','nasr_city','downtown','maadi','october','sheikh_zayed','giza',
                              'smart_village','tenth_ramadan','obour','alexandria','other']::text[]),
  preferred_location_other  text check (char_length(preferred_location_other) <= 120),
  max_commute_minutes       int  not null check (max_commute_minutes between 0 and 240),
  work_modes                text[] not null check (cardinality(work_modes) >= 1 and work_modes <@ array['onsite','hybrid','remote']::text[]),
  min_salary_range          text not null check (min_salary_range in
                              ('lt_10k','10_15k','15_20k','20_30k','30_45k','45_60k','60_80k','80k_plus')),

  cv_path                   text not null,
  linkedin_url              text check (linkedin_url is null or linkedin_url ~* '^https?://([a-z]{2,3}\.)?(www\.)?linkedin\.com/'),

  applications_last_month   text not null check (applications_last_month in ('0','1_10','11_30','30_plus')),
  willing_to_pay            text not null check (willing_to_pay in ('yes','maybe_lower','no')),
  fair_price_egp            int  check (fair_price_egp is null or fair_price_egp between 0 and 100000),
  heard_from                text not null check (heard_from in
                              ('linkedin','facebook','whatsapp','friend','hr_community','other')),
  heard_from_other          text check (char_length(heard_from_other) <= 120),
  price_shown_egp           text  -- the price constant the applicant saw when answering willingness-to-pay
);

create unique index if not exists applicants_email_unique on public.applicants (lower(email));
create index if not exists applicants_status_idx on public.applicants (status);
create index if not exists applicants_created_idx on public.applicants (created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists applicants_touch on public.applicants;
create trigger applicants_touch before update on public.applicants
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- consents (one row per consent item, granted or declined, with text version)
-- ---------------------------------------------------------------------------
create table if not exists public.consents (
  id               bigint generated always as identity primary key,
  applicant_id     uuid not null references public.applicants(id) on delete cascade,
  consent_key      text not null check (consent_key in
                     ('process_profile','cross_border','contact_email',
                      'contact_whatsapp','anonymized_improvement','marketing')),
  granted          boolean not null,
  required         boolean not null,
  consent_version  text not null,
  consent_text     text not null,           -- exact wording the applicant saw
  language         text not null check (language in ('ar','en')),
  granted_at       timestamptz not null,    -- when the box was ticked (client clock)
  recorded_at      timestamptz not null default now(),  -- server clock
  unique (applicant_id, consent_key)
);

-- ---------------------------------------------------------------------------
-- deletion_requests
-- ---------------------------------------------------------------------------
create table if not exists public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  email         text check (email is null or (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254)),
  email_sha256  text,                       -- kept after completion as proof of deletion
  reason        text check (char_length(reason) <= 1000),
  status        text not null default 'pending' check (status in ('pending','completed','rejected')),
  completed_at  timestamptz,
  completed_by  uuid,
  deleted_applicants int
);
create index if not exists deletion_requests_status_idx on public.deletion_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- admin_notes
-- ---------------------------------------------------------------------------
create table if not exists public.admin_notes (
  id            bigint generated always as identity primary key,
  applicant_id  uuid not null references public.applicants(id) on delete cascade,
  author_id     uuid not null default auth.uid(),
  author_email  text default (auth.jwt() ->> 'email'),
  note          text not null check (char_length(note) between 1 and 5000),
  created_at    timestamptz not null default now()
);
create index if not exists admin_notes_applicant_idx on public.admin_notes (applicant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- page_views — privacy-friendly counter: path + day + count. No IP, no cookies, no user agent.
-- ---------------------------------------------------------------------------
create table if not exists public.page_views (
  path  text not null,
  day   date not null default current_date,
  count int  not null default 0,
  primary key (path, day)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pilot_settings    enable row level security;
alter table public.applicants        enable row level security;
alter table public.consents          enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.admin_notes       enable row level security;
alter table public.page_views        enable row level security;

-- Start from zero privileges for the public roles, then grant precisely.
revoke all on public.pilot_settings, public.applicants, public.consents,
              public.deletion_requests, public.admin_notes, public.page_views
  from anon, authenticated;

-- pilot_settings: admins read/update
grant select, update on public.pilot_settings to authenticated;
drop policy if exists settings_admin_read on public.pilot_settings;
create policy settings_admin_read on public.pilot_settings for select to authenticated using (public.is_admin());
drop policy if exists settings_admin_update on public.pilot_settings;
create policy settings_admin_update on public.pilot_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- applicants: public insert only through submit_application(); admins full access
grant select, update, delete on public.applicants to authenticated;
drop policy if exists applicants_admin_select on public.applicants;
create policy applicants_admin_select on public.applicants for select to authenticated using (public.is_admin());
drop policy if exists applicants_admin_update on public.applicants;
create policy applicants_admin_update on public.applicants for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists applicants_admin_delete on public.applicants;
create policy applicants_admin_delete on public.applicants for delete to authenticated using (public.is_admin());

-- consents: admins read; consent records are never edited
grant select on public.consents to authenticated;
drop policy if exists consents_admin_select on public.consents;
create policy consents_admin_select on public.consents for select to authenticated using (public.is_admin());

-- deletion_requests: anyone may INSERT a pending request (no read-back); admins read/update
grant insert (email, reason) on public.deletion_requests to anon, authenticated;
grant select, update on public.deletion_requests to authenticated;
drop policy if exists deletion_public_insert on public.deletion_requests;
create policy deletion_public_insert on public.deletion_requests for insert to anon, authenticated
  with check (status = 'pending' and email is not null and completed_at is null);
drop policy if exists deletion_admin_select on public.deletion_requests;
create policy deletion_admin_select on public.deletion_requests for select to authenticated using (public.is_admin());
drop policy if exists deletion_admin_update on public.deletion_requests;
create policy deletion_admin_update on public.deletion_requests for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- admin_notes: admins only
grant select, insert, delete on public.admin_notes to authenticated;
drop policy if exists notes_admin_all on public.admin_notes;
create policy notes_admin_all on public.admin_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and author_id = auth.uid());

-- page_views: admins read; writes only via track_page_view()
grant select on public.page_views to authenticated;
drop policy if exists page_views_admin_select on public.page_views;
create policy page_views_admin_select on public.page_views for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Public functions
-- ---------------------------------------------------------------------------

-- Seats taken = everyone who holds or held a pilot seat (not waitlisted / rejected).
create or replace function public.pilot_seats()
returns table (total int, taken int, remaining int)
language sql
stable
security definer
set search_path = public
as $$
  select s.total_seats,
         t.taken,
         greatest(s.total_seats - t.taken, 0)
  from public.pilot_settings s,
       lateral (select count(*)::int as taken from public.applicants
                where status in ('new','accepted','active','done')) t;
$$;

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
  v_required  text[] := array['process_profile','cross_border','contact_email'];
  v_key       text;
  c           jsonb;
begin
  -- Honeypot: bots fill hidden fields.
  if coalesce(payload ->> 'website', '') <> '' then
    raise exception 'rejected' using errcode = 'P0001';
  end if;

  -- All required consents must be present and granted.
  foreach v_key in array v_required loop
    if not exists (
      select 1 from jsonb_array_elements(consents) e
      where e ->> 'key' = v_key and (e ->> 'granted')::boolean is true
    ) then
      raise exception 'missing_required_consent:%', v_key using errcode = 'P0001';
    end if;
  end loop;

  -- CV must have been uploaded into this applicant's own folder in the private bucket.
  if v_cv_path is null or split_part(v_cv_path, '/', 1) <> v_id::text then
    raise exception 'invalid_cv_path' using errcode = 'P0001';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'cvs' and name = v_cv_path) then
    raise exception 'cv_not_found' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.applicants where lower(email) = lower(payload ->> 'email')) then
    raise exception 'duplicate_email' using errcode = 'P0001';
  end if;

  -- Serialize seat assignment so seat 30 is never handed out twice.
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

create or replace function public.track_page_view(p_path text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  -- Only count known public pages so the table can't be filled with junk.
  if p_path not in ('/', '/consent', '/apply', '/thank-you', '/delete-my-data', '/privacy', '/terms') then
    return;
  end if;
  insert into public.page_views (path, day, count) values (p_path, current_date, 1)
  on conflict (path, day) do update set count = public.page_views.count + 1;
end;
$$;

-- Admin: delete every DB row for an email (CV files are removed by the client via the
-- Storage API *before* calling this, because deleting storage.objects rows directly
-- does not remove the underlying file). Marks the request completed and redacts the email.
create or replace function public.admin_complete_deletion(p_request_id uuid)
returns int
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_hash  text;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select lower(email) into v_email from public.deletion_requests
   where id = p_request_id and status = 'pending' for update;
  if v_email is null then
    raise exception 'request_not_pending' using errcode = 'P0001';
  end if;
  v_hash := encode(digest(v_email, 'sha256'), 'hex');

  delete from public.applicants where lower(email) = v_email;  -- cascades consents + admin_notes
  get diagnostics v_count = row_count;

  -- Close every pending request from this person and redact it; keep only a hash as proof.
  update public.deletion_requests
     set email_sha256 = v_hash,
         email = null,
         reason = null,
         status = 'completed',
         completed_at = now(),
         completed_by = auth.uid(),
         deleted_applicants = case when id = p_request_id then v_count else 0 end
   where lower(email) = v_email and status = 'pending';

  return v_count;
end;
$$;

-- Admin: CV files uploaded >24h ago that no application references (abandoned forms).
create or replace function public.admin_orphan_cvs()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select o.name from storage.objects o
   where public.is_admin()
     and o.bucket_id = 'cvs'
     and o.created_at < now() - interval '24 hours'
     and not exists (select 1 from public.applicants a where a.cv_path = o.name);
$$;

revoke all on function public.pilot_seats()                         from public, anon, authenticated;
revoke all on function public.submit_application(jsonb, jsonb)      from public, anon, authenticated;
revoke all on function public.track_page_view(text)                 from public, anon, authenticated;
revoke all on function public.admin_complete_deletion(uuid)         from public, anon, authenticated;
revoke all on function public.admin_orphan_cvs()                    from public, anon, authenticated;
grant execute on function public.pilot_seats()                      to anon, authenticated;
grant execute on function public.submit_application(jsonb, jsonb)   to anon, authenticated;
grant execute on function public.track_page_view(text)              to anon, authenticated;
grant execute on function public.admin_complete_deletion(uuid)      to authenticated;
grant execute on function public.admin_orphan_cvs()                 to authenticated;
grant execute on function public.is_admin()                         to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private CV bucket (5 MB, PDF/DOCX only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 5242880,
        array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public may upload ONE new file into a fresh "<uuid>/cv.<pdf|docx>" path. No read, no overwrite, no list.
drop policy if exists cvs_public_upload on storage.objects;
create policy cvs_public_upload on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'cvs'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/cv\.(pdf|docx)$'
  );

-- Admins can read (needed to mint signed URLs) and delete CVs.
drop policy if exists cvs_admin_select on storage.objects;
create policy cvs_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and public.is_admin());
drop policy if exists cvs_admin_delete on storage.objects;
create policy cvs_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and public.is_admin());
