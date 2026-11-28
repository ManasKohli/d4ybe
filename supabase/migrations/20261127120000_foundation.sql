-- Foundation (docs/architecture.md section 4, task T4): lockdown, shared helpers,
-- program_modules, cohorts and identity (profiles, invites, student and mentor profiles).
--
-- Security model (section 8): only the Express API reads or writes app data. It connects as
-- the table owner through the pooler, so RLS does not apply to it. Every table has RLS on and
-- NO policies, and the Data API roles (anon, authenticated) hold no privileges at all, so the
-- publishable key in the browser can't read or write a single row through PostgREST.

-- ---------------------------------------------------------------------------------------------
-- Lockdown: nothing created in public by this or any later migration is reachable from the
-- browser-facing roles. service_role keeps its access for Supabase Studio and the secret key.
-- ---------------------------------------------------------------------------------------------
revoke all on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated; -- PostgREST needs usage to start; no objects are granted

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
-- EXECUTE to PUBLIC is a global default that a per-schema rule can't remove; revoke it globally too.
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------------------------

-- Keeps updated_at honest on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- For append-only tables (credit_ledger, audit_log): corrections are new rows, never edits.
-- Changes made by a foreign-key action (deleting a person cascades or nulls their rows) run
-- inside Postgres's own RI trigger, so pg_trigger_depth() > 1; those are allowed through.
create function public.reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

-- Row triggers don't see TRUNCATE; this statement trigger closes that gap.
create function public.reject_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Program (D8, D19). The only backend copy of the module list, chapter slugs and rubric
-- criteria. Seeded from d4yfe src/data/modules.ts + portal.ts. When the FE changes a module,
-- chapter or rubric, add a migration in the same week.
-- ---------------------------------------------------------------------------------------------
create table public.program_modules (
  slug            text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null check (length(title) between 1 and 200),
  rubric_criteria text[] not null default '{}',
  chapter_slugs   text[] not null default '{}',
  sort_order      integer not null unique check (sort_order >= 0),
  check (array_position(chapter_slugs, null) is null),
  check (array_position(rubric_criteria, null) is null)
);

insert into public.program_modules (slug, title, rubric_criteria, chapter_slugs, sort_order) values
  ('start-here', 'Start here', '{}'::text[], array['welcome', 'choose-your-track', 'timeline-quiz', 'platform-tour', 'code-of-conduct', 'join-community']::text[], 0),
  ('applicant-strategy', 'Applicant Strategy & Prerequisites', array['Completeness', 'Accuracy of school requirements', 'Realistic timeline']::text[], array['big-picture-two-systems', 'building-your-school-list', 'aadsas-walkthrough', 'canadian-walkthroughs', 'build-your-timeline', 'common-mistakes']::text[], 1),
  ('dat', 'DAT Preparation', array['Uses diagnostic results', 'Realistic weekly hours', 'Covers every section']::text[], array['dat-101', 'picking-your-test-date', 'diagnostic-test', 'building-your-study-plan', 'section-strategies', 'full-length-practice', 'test-day-and-next-steps']::text[], 2),
  ('casper', 'CASPer Preparation', array['Critical thinking', 'Communication', 'Empathy', 'Decision-making']::text[], array['what-casper-is', 'the-format', 'what-raters-look-for', 'd4y-response-framework', 'scenario-types', 'video-responses', 'typed-responses', 'test-day']::text[], 3),
  ('personal-statement', 'Personal Statement Lab', array['Reflection', 'Connection to dentistry', 'Cohesive narrative', 'Strong introduction']::text[], array['what-committees-want', 'brainstorming', 'structure', 'showing-reflection', 'openings-and-endings', 'revising', 'formatting-for-aadsas', 'canadian-essays']::text[], 4),
  ('application-entries', 'Experiences & Application Entries', array['Clear', 'Concise', 'Reflective', 'Specific', 'Impactful', 'Consistent with overall narrative']::text[], array['experience-log', 'choosing-categories', '600-character-entries', 'your-top-six', 'achievements', 'canadian-formats', 'documenting-hours']::text[], 5),
  ('interview', 'Interview Preparation', array['Structure', 'Reflection', 'Professionalism']::text[], array['interview-formats', 'core-questions', 'ethics-and-mmi', 'recorded-video-assessments', 'virtual-setup', 'after-the-interview']::text[], 6),
  ('final-check-in', 'Final Application Check-In', '{}'::text[], array['pre-session-questionnaire', 'book-your-session', 'your-action-plan']::text[], 7);

-- Postgres can't foreign-key into an array, so rows that name a chapter are checked here.
-- Expects the row to have module_slug and chapter_slug columns; a null chapter_slug passes.
create function public.check_chapter_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.chapter_slug is not null and not exists (
    select 1 from public.program_modules m
    where m.slug = new.module_slug and new.chapter_slug = any (m.chapter_slugs)
  ) then
    raise exception 'unknown chapter "%" for module "%"', new.chapter_slug, new.module_slug
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Cohorts (seats, D7/D14)
-- ---------------------------------------------------------------------------------------------
create table public.cohorts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(name) between 1 and 120),
  capacity   integer not null default 25 check (capacity > 0),
  starts_on  date,
  ends_on    date,
  is_open    boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- ---------------------------------------------------------------------------------------------
-- Identity (D18, D23)
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               text not null default 'student' check (role in ('student', 'mentor', 'admin')),
  full_name          text check (length(full_name) <= 200),
  email              text not null unique check (email = lower(email) and length(email) <= 320),
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Written only by the API, right before auth.admin.inviteUserByEmail (D23).
create table public.invites (
  email       text primary key check (email = lower(email) and length(email) <= 320),
  role        text not null check (role in ('mentor', 'admin')),
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);
create index invites_invited_by_idx on public.invites (invited_by);

create table public.student_profiles (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  track             text check (track in ('Canada', 'US')),
  cycle             text check (cycle ~ '^[0-9]{4}(-[0-9]{4})?$'),
  cohort_id         uuid references public.cohorts (id) on delete restrict,
  primary_mentor_id uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index student_profiles_cohort_idx on public.student_profiles (cohort_id);
create index student_profiles_mentor_idx on public.student_profiles (primary_mentor_id);
create trigger student_profiles_updated_at before update on public.student_profiles
  for each row execute function public.set_updated_at();

create table public.mentor_profiles (
  user_id                   uuid primary key references public.profiles (id) on delete cascade,
  title                     text check (length(title) <= 200),
  monthly_review_limit      integer not null default 0 check (monthly_review_limit >= 0),
  monthly_session_limit     integer not null default 0 check (monthly_session_limit >= 0),
  scheduling_url            text check (scheduling_url ~ '^https://' and length(scheduling_url) <= 2048),
  status                    text not null default 'onboarding' check (status in ('onboarding', 'active', 'paused')),
  orientation_done_at       timestamptz,
  confidentiality_signed_at timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- A mentor is active only after orientation and the confidentiality agreement.
  check (status <> 'active' or (orientation_done_at is not null and confidentiality_signed_at is not null))
);
create trigger mentor_profiles_updated_at before update on public.mentor_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- New auth user → profile (D18, D23).
-- Everyone starts as a student. The role comes from a pending invite ONLY when Supabase
-- creates the user through an invite: GoTrue inserts the row first and sets
-- auth.users.invited_at in a follow-up UPDATE (handle_user_invited below), so both paths are
-- covered. A self-sign-up with an invited address, or anything in raw_user_meta_data, never
-- grants staff access.
-- ---------------------------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(new.email);
  v_role  text := 'student';
begin
  if v_email is null then
    raise exception 'auth user % has no email', new.id using errcode = '23502';
  end if;

  if new.invited_at is not null then
    update public.invites
       set accepted_at = now()
     where email = v_email and accepted_at is null
    returning role into v_role;
    v_role := coalesce(v_role, 'student');
  end if;

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    v_role,
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 200), ''),
    v_email
  );

  if v_role = 'student' then
    insert into public.student_profiles (user_id) values (new.id);
  elsif v_role = 'mentor' then
    insert into public.mentor_profiles (user_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- GoTrue's invite flow: the user row exists (as a student) and invited_at is set afterwards.
-- An account that already has a password was created by someone signing up themselves. If a
-- staff invite is pending for it, the whole invite is refused (raise, so GoTrue rolls back and
-- sends no link): promoting it would hand staff access to whoever set that password, and even
-- a plain confirmation link would confirm their account. An admin deletes that account in
-- Authentication → Users and invites again.
create function public.handle_user_invited()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if coalesce(new.encrypted_password, '') <> '' then
    if exists (select 1 from public.invites where email = lower(new.email) and accepted_at is null) then
      raise exception 'an account already exists for %; delete it before inviting', lower(new.email)
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  update public.invites
     set accepted_at = now()
   where email = lower(new.email) and accepted_at is null
  returning role into v_role;
  if v_role is null then
    return new;
  end if;

  update public.profiles set role = v_role where id = new.id and role = 'student';
  -- The placeholder student row the insert trigger made; never one holding a seat.
  delete from public.student_profiles where user_id = new.id and cohort_id is null;
  if v_role = 'mentor' then
    insert into public.mentor_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_invited
  after update of invited_at on auth.users
  for each row
  when (old.invited_at is null and new.invited_at is not null)
  execute function public.handle_user_invited();

-- Keep profiles.email in step when a user confirms an email change.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email and new.email is not null)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------------------------
-- RLS on, no policies.
-- ---------------------------------------------------------------------------------------------
alter table public.program_modules  enable row level security;
alter table public.cohorts          enable row level security;
alter table public.profiles         enable row level security;
alter table public.invites          enable row level security;
alter table public.student_profiles enable row level security;
alter table public.mentor_profiles  enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;
