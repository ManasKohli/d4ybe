-- Local development data only. Runs on `supabase start` / `supabase db reset` against the local
-- Docker stack; `supabase db push` never sends it to a hosted project. Do not copy these
-- accounts or passwords anywhere real.
--
-- program_modules is seeded by migration, not here (D8).
--
-- Test accounts (sign in from the FE at http://localhost:5173, or with the Auth API):
--   admin@d4y.local    admin     password: D4yLocalDev1
--   mentor@d4y.local   mentor    password: D4yLocalDev1
--   student@d4y.local  student   password: D4yLocalDev1
-- Staff accounts go through the real invite path (an invites row + auth.users.invited_at), so
-- the handle_new_user trigger assigns their roles exactly as it will in production.

insert into public.cohorts (id, name, capacity, starts_on, ends_on)
values ('00000000-0000-4000-a000-000000000001', 'Pilot (local dev)', 25, '2027-01-11', '2027-08-31');

insert into public.invites (email, role) values
  ('admin@d4y.local', 'admin'),
  ('mentor@d4y.local', 'mentor');

-- GoTrue reads the token columns as strings, so they must be '' rather than null.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('D4yLocalDev1', extensions.gen_salt('bf')), now(), u.invited_at,
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-4000-a000-0000000000a1'::uuid, 'admin@d4y.local',   'Avery Admin',    now()),
  ('00000000-0000-4000-a000-0000000000b1'::uuid, 'mentor@d4y.local',  'Morgan Mentor',  now()),
  ('00000000-0000-4000-a000-0000000000c1'::uuid, 'student@d4y.local', 'Sam Student',    null::timestamptz)
) as u (id, email, full_name, invited_at);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('admin@d4y.local', 'mentor@d4y.local', 'student@d4y.local');

-- The mentor is active and has a booking link (D2).
update public.mentor_profiles
   set title = 'DMD candidate', monthly_review_limit = 8, monthly_session_limit = 4,
       scheduling_url = 'https://cal.com/d4y-local-mentor',
       orientation_done_at = now(), confidentiality_signed_at = now(), status = 'active'
 where user_id = '00000000-0000-4000-a000-0000000000b1';

-- The student holds a seat, has a mentor, two modules and some credits, granted by the admin.
update public.student_profiles
   set track = 'Canada', cycle = '2027', cohort_id = '00000000-0000-4000-a000-000000000001',
       primary_mentor_id = '00000000-0000-4000-a000-0000000000b1'
 where user_id = '00000000-0000-4000-a000-0000000000c1';

insert into public.enrollments (student_id, module_slug, source, granted_by) values
  ('00000000-0000-4000-a000-0000000000c1', 'applicant-strategy', 'admin', '00000000-0000-4000-a000-0000000000a1'),
  ('00000000-0000-4000-a000-0000000000c1', 'casper',             'admin', '00000000-0000-4000-a000-0000000000a1');

insert into public.credit_ledger (student_id, kind, delta, reason, granted_by) values
  ('00000000-0000-4000-a000-0000000000c1', 'review',     3, 'Local dev grant', '00000000-0000-4000-a000-0000000000a1'),
  ('00000000-0000-4000-a000-0000000000c1', 'one_on_one', 1, 'Local dev grant', '00000000-0000-4000-a000-0000000000a1');
