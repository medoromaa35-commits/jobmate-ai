-- Phase 2: jobs, parsed CV profiles, AI matches + tailored CVs. Admin-only.
-- AI calls happen in the `ai-admin` Edge Function (service role), which checks the caller is an admin.

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  source        text not null default 'manual' check (source in ('manual','member_link','import')),
  source_url    text check (source_url is null or source_url ~* '^https?://'),
  title         text not null check (char_length(title) between 2 and 200),
  company       text check (char_length(company) <= 200),
  location      text check (char_length(location) <= 200),
  work_mode     text check (work_mode is null or work_mode in ('onsite','hybrid','remote')),
  description   text not null check (char_length(description) between 30 and 30000),
  status        text not null default 'active' check (status in ('active','closed'))
);
create index if not exists jobs_status_idx on public.jobs (status, created_at desc);
create unique index if not exists jobs_source_url_unique on public.jobs (source_url) where source_url is not null;
drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

create table if not exists public.cv_profiles (
  applicant_id  uuid primary key references public.applicants(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  cv_path       text not null,
  parsed        jsonb not null,
  model         text
);
drop trigger if exists cv_profiles_touch on public.cv_profiles;
create trigger cv_profiles_touch before update on public.cv_profiles for each row execute function public.touch_updated_at();

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  applicant_id  uuid not null references public.applicants(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  score         int check (score between 0 and 100),
  verdict       text check (verdict in ('strong','good','partial','weak')),
  analysis      jsonb,                 -- strengths, gaps, advice, fit flags
  status        text not null default 'suggested'
                check (status in ('suggested','approved','sent','applied','interview','rejected','hidden')),
  tailored_cv   jsonb,                 -- same shape as cv_profiles.parsed
  cover_letter  text,
  changes       jsonb,                 -- what the tailoring changed, for human review
  model         text,
  unique (applicant_id, job_id)
);
create index if not exists matches_applicant_idx on public.matches (applicant_id, score desc);
drop trigger if exists matches_touch on public.matches;
create trigger matches_touch before update on public.matches for each row execute function public.touch_updated_at();

alter table public.jobs        enable row level security;
alter table public.cv_profiles enable row level security;
alter table public.matches     enable row level security;
revoke all on public.jobs, public.cv_profiles, public.matches from anon, authenticated;

grant select, insert, update, delete on public.jobs to authenticated;
drop policy if exists jobs_admin_all on public.jobs;
create policy jobs_admin_all on public.jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, delete on public.cv_profiles to authenticated;
drop policy if exists cv_profiles_admin_select on public.cv_profiles;
create policy cv_profiles_admin_select on public.cv_profiles for select to authenticated using (public.is_admin());
drop policy if exists cv_profiles_admin_delete on public.cv_profiles;
create policy cv_profiles_admin_delete on public.cv_profiles for delete to authenticated using (public.is_admin());

-- Admins may review/edit matches (status, tailored CV text, cover letter); creation is by the Edge Function.
grant select, update, delete on public.matches to authenticated;
drop policy if exists matches_admin_select on public.matches;
create policy matches_admin_select on public.matches for select to authenticated using (public.is_admin());
drop policy if exists matches_admin_update on public.matches;
create policy matches_admin_update on public.matches for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists matches_admin_delete on public.matches;
create policy matches_admin_delete on public.matches for delete to authenticated using (public.is_admin());
