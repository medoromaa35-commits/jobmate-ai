-- Run after stub_supabase.sql + migration. Every check raises on failure.
\set ON_ERROR_STOP 1
update public.pilot_settings set total_seats = 2;

create or replace function pg_temp.payload(p_id uuid, p_email text) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'cv_path', p_id || '/cv.pdf', 'language','ar',
    'full_name','Test Person','email',p_email,'mobile','+201001234567',
    'current_job_title','HR Specialist','years_experience',4,'current_industry','FMCG',
    'target_roles', '["hr_generalist","payroll"]'::jsonb, 'preferred_locations','["maadi"]'::jsonb,
    'max_commute_minutes',60,'work_modes','["hybrid"]'::jsonb,'min_salary_range','20_30k',
    'applications_last_month','11_30','willing_to_pay','maybe_lower','fair_price_egp','300',
    'heard_from','linkedin','price_shown_egp','[PRICE_TBD]');
$$;
create or replace function pg_temp.consents(all_required boolean) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('key','process_profile','granted',true,'version','v1','text','t','language','ar'),
    jsonb_build_object('key','cross_border','granted',all_required,'version','v1','text','t','language','ar'),
    jsonb_build_object('key','contact_email','granted',true,'version','v1','text','t','language','ar'),
    jsonb_build_object('key','contact_whatsapp','granted',false,'version','v1','text','t','language','ar'),
    jsonb_build_object('key','anonymized_improvement','granted',true,'version','v1','text','t','language','ar'),
    jsonb_build_object('key','marketing','granted',false,'version','v1','text','t','language','ar'));
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ===== anon =====
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);

-- 1. seats visible
do $$ begin if (select remaining from public.pilot_seats()) <> 2 then raise exception 'FAIL seats'; end if; end $$;

-- 2. upload policy: good path allowed, bad path refused
insert into storage.objects (bucket_id, name) values
  ('cvs','11111111-1111-4111-8111-111111111111/cv.pdf'),
  ('cvs','22222222-2222-4222-8222-222222222222/cv.docx'),
  ('cvs','33333333-3333-4333-8333-333333333333/cv.pdf'),
  ('cvs','44444444-4444-4444-8444-444444444444/cv.pdf');
do $$ begin
  begin insert into storage.objects (bucket_id, name) values ('cvs','../evil.exe'); raise exception 'FAIL bad path accepted';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('avatars','55555555-5555-4555-8555-555555555555/cv.pdf'); raise exception 'FAIL other bucket accepted';
  exception when insufficient_privilege then null; end;
end $$;
-- anon cannot list CVs
do $$ begin if (select count(*) from storage.objects) <> 0 then raise exception 'FAIL anon can list cvs'; end if; end $$;

-- 3. missing required consent is refused
do $$ begin
  perform public.submit_application(pg_temp.payload('11111111-1111-4111-8111-111111111111','a@x.com'), pg_temp.consents(false));
  raise exception 'FAIL missing consent accepted';
exception when sqlstate 'P0001' then
  if sqlerrm not like 'missing_required_consent:cross_border' then raise; end if;
end $$;

-- 4. cv path must belong to the applicant id
do $$ begin
  perform public.submit_application(pg_temp.payload('11111111-1111-4111-8111-111111111111','a@x.com') || '{"cv_path":"22222222-2222-4222-8222-222222222222/cv.docx"}', pg_temp.consents(true));
  raise exception 'FAIL foreign cv accepted';
exception when sqlstate 'P0001' then if sqlerrm <> 'invalid_cv_path' then raise; end if; end $$;

-- 5. two seats then waitlist
do $$ declare r jsonb; begin
  r := public.submit_application(pg_temp.payload('11111111-1111-4111-8111-111111111111','a@x.com'), pg_temp.consents(true));
  if r->>'status' <> 'new' then raise exception 'FAIL 1st status %', r; end if;
  r := public.submit_application(pg_temp.payload('22222222-2222-4222-8222-222222222222','b@x.com') || '{"cv_path":"22222222-2222-4222-8222-222222222222/cv.docx"}', pg_temp.consents(true));
  if r->>'status' <> 'new' then raise exception 'FAIL 2nd status %', r; end if;
  r := public.submit_application(pg_temp.payload('33333333-3333-4333-8333-333333333333','c@x.com'), pg_temp.consents(true));
  if r->>'status' <> 'waitlist' then raise exception 'FAIL 3rd should be waitlist %', r; end if;
end $$;

-- 6. duplicate email refused (case-insensitive)
do $$ begin
  perform public.submit_application(pg_temp.payload('44444444-4444-4444-8444-444444444444','A@X.com'), pg_temp.consents(true));
  raise exception 'FAIL duplicate accepted';
exception when sqlstate 'P0001' then if sqlerrm <> 'duplicate_email' then raise; end if; end $$;

-- 7. anon cannot read or write tables directly
do $$ begin
  begin perform 1 from public.applicants; raise exception 'FAIL anon select applicants'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.consents; raise exception 'FAIL anon select consents'; exception when insufficient_privilege then null; end;
  begin insert into public.applicants (id) values (gen_random_uuid()); raise exception 'FAIL anon insert applicants'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.deletion_requests; raise exception 'FAIL anon select deletion'; exception when insufficient_privilege then null; end;
  begin update public.deletion_requests set status='completed'; raise exception 'FAIL anon update deletion'; exception when insufficient_privilege then null; end;
  begin perform public.admin_complete_deletion(gen_random_uuid()); raise exception 'FAIL anon admin fn'; exception when insufficient_privilege then null; end;
end $$;

-- 8. anon can file a deletion request (but not with forged status)
insert into public.deletion_requests (email, reason) values ('a@x.com', 'no longer looking');
do $$ begin
  begin execute $q$insert into public.deletion_requests (email, status) values ('a@x.com','completed')$q$;
    raise exception 'FAIL forged status'; exception when insufficient_privilege then null; end;
end $$;

-- 9. page counter
select public.track_page_view('/'); select public.track_page_view('/'); select public.track_page_view('/junk');
reset role;

-- ===== authenticated non-admin =====
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","app_metadata":{}}', false);
do $$ begin
  if (select count(*) from public.applicants) <> 0 then raise exception 'FAIL non-admin sees applicants'; end if;
  if (select count(*) from storage.objects) <> 0 then raise exception 'FAIL non-admin sees cvs'; end if;
  begin perform public.admin_complete_deletion(gen_random_uuid()); raise exception 'FAIL non-admin deletion'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== admin =====
set role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","email":"admin@jobmate.ai","app_metadata":{"role":"admin"}}', false);
do $$ declare n int; rid uuid; begin
  if (select count(*) from public.applicants) <> 3 then raise exception 'FAIL admin applicants'; end if;
  if (select count(*) from public.consents) <> 18 then raise exception 'FAIL admin consents'; end if;
  if (select count(*) from storage.objects) <> 4 then raise exception 'FAIL admin cvs'; end if;
  if (select count from public.page_views where path='/') <> 2 then raise exception 'FAIL page views'; end if;
  if exists (select 1 from public.page_views where path='/junk') then raise exception 'FAIL junk path counted'; end if;
  insert into public.admin_notes (applicant_id, note) values ('11111111-1111-4111-8111-111111111111', 'Strong payroll background');
  update public.applicants set status='accepted' where id='11111111-1111-4111-8111-111111111111';
  -- rejecting someone frees a seat
  update public.applicants set status='rejected' where id='22222222-2222-4222-8222-222222222222';
  if (select remaining from public.pilot_seats()) <> 1 then raise exception 'FAIL seat not freed'; end if;
  select id into rid from public.deletion_requests where status='pending';
  n := public.admin_complete_deletion(rid);
  if n <> 1 then raise exception 'FAIL deleted % rows', n; end if;
  if exists (select 1 from public.applicants where email='a@x.com') then raise exception 'FAIL applicant remains'; end if;
  if exists (select 1 from public.consents where applicant_id='11111111-1111-4111-8111-111111111111') then raise exception 'FAIL consents remain'; end if;
  if exists (select 1 from public.admin_notes) then raise exception 'FAIL notes remain'; end if;
  if (select email from public.deletion_requests where id=rid) is not null then raise exception 'FAIL email not redacted'; end if;
  if (select status from public.deletion_requests where id=rid) <> 'completed' then raise exception 'FAIL not completed'; end if;
end $$;
reset role;
\echo ALL RLS TESTS PASSED
