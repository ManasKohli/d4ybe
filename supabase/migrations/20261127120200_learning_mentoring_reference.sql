-- Learning, sessions, mentoring and reference (docs/architecture.md section 4).
-- Content tables (lessons, materials) and the Storage buckets come with their build steps
-- (T10, T11), once the founders confirm D25–D31.

-- ---------------------------------------------------------------------------------------------
-- Learning
-- ---------------------------------------------------------------------------------------------
create table public.chapter_progress (
  student_id   uuid not null references public.profiles (id) on delete cascade,
  module_slug  text not null references public.program_modules (slug) on delete restrict,
  chapter_slug text not null,
  completed_at timestamptz not null default now(),
  primary key (student_id, module_slug, chapter_slug)
);
create trigger chapter_progress_chapter before insert or update on public.chapter_progress
  for each row execute function public.check_chapter_slug();

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  module_slug  text not null references public.program_modules (slug) on delete restrict,
  cohort_id    uuid not null references public.cohorts (id) on delete cascade,
  title        text not null check (length(title) between 1 and 200),
  instructions text check (length(instructions) <= 10000),
  due_at       timestamptz,
  needs_review boolean not null default true,
  -- D36: the expected answers, in order.
  answer_spec  text[] not null default '{file}' check (
    cardinality(answer_spec) between 1 and 20
    and answer_spec <@ array['file', 'video_link', 'text']::text[]
  ),
  created_at   timestamptz not null default now()
);
create index assignments_cohort_module_idx on public.assignments (cohort_id, module_slug);
create index assignments_module_idx on public.assignments (module_slug);

-- One row per version; one review and one round each (D16, D36).
create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete restrict,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  version       integer not null check (version >= 1),
  note          text check (length(note) <= 2000),
  submitted_at  timestamptz not null default now(),
  unique (assignment_id, student_id, version)
);
create index submissions_student_idx on public.submissions (student_id);

create table public.submission_items (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  sort_order    integer not null check (sort_order >= 0),
  kind          text not null check (kind in ('file', 'video_link', 'text')),
  label         text not null check (length(label) between 1 and 100),
  storage_path  text unique check (length(storage_path) <= 1024),
  file_name     text check (length(file_name) <= 255),
  video_url     text check (video_url ~ '^https://' and length(video_url) <= 2048),
  body          text check (length(body) <= 20000),
  unique (submission_id, sort_order),
  -- Exactly the fields that match the kind (D36).
  check (
    (kind = 'file'       and storage_path is not null and file_name is not null and video_url is null and body is null) or
    (kind = 'video_link' and video_url is not null and storage_path is null and file_name is null and body is null) or
    (kind = 'text'       and body is not null and storage_path is null and file_name is null and video_url is null)
  )
);

create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  submission_id      uuid not null references public.submissions (id) on delete cascade,
  mentor_id          uuid not null references public.profiles (id) on delete restrict,
  status             text not null default 'assigned' check (status in ('assigned', 'in_progress', 'completed', 'reassigned')),
  assigned_at        timestamptz not null default now(),
  due_at             timestamptz not null,
  scores             jsonb not null default '{}' check (jsonb_typeof(scores) = 'object'),
  strengths          text check (length(strengths) <= 5000),
  priorities         text[] not null default '{}' check (cardinality(priorities) <= 3),
  follow_up          text check (length(follow_up) <= 2000),
  feedback_file_path text check (length(feedback_file_path) <= 1024),
  feedback_file_name text check (length(feedback_file_name) <= 255),
  completed_at       timestamptz,
  updated_at         timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  check ((feedback_file_path is null) = (feedback_file_name is null))
);
-- One live review per submission; reassigned rows stay as history.
create unique index reviews_one_active_per_submission on public.reviews (submission_id)
  where status <> 'reassigned';
create index reviews_mentor_status_idx on public.reviews (mentor_id, status);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.credit_ledger
  add constraint credit_ledger_review_id_fkey
  foreign key (review_id) references public.reviews (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Sessions and mentoring
-- ---------------------------------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(title) between 1 and 200),
  kind         text not null check (kind in ('live', 'group', 'drop-in')),
  module_slug  text references public.program_modules (slug) on delete restrict,
  track        text check (track in ('Canada', 'US')),
  starts_at    timestamptz not null,
  duration_min integer not null check (duration_min between 1 and 600),
  join_url     text check (join_url ~ '^https://' and length(join_url) <= 2048),
  created_at   timestamptz not null default now()
);
create index events_starts_at_idx on public.events (starts_at);
create index events_module_idx on public.events (module_slug);

create table public.volunteer_hours (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  date       date not null,
  activity   text not null check (length(activity) between 1 and 200),
  student_id uuid references public.profiles (id) on delete set null,
  hours      numeric(4, 2) not null check (hours > 0 and hours <= 24),
  source     text not null check (source in ('review', 'manual')),
  source_id  uuid,
  created_at timestamptz not null default now(),
  check ((source = 'review') = (source_id is not null))
);
-- A completed review logs its hours once.
create unique index volunteer_hours_one_per_review on public.volunteer_hours (source_id)
  where source = 'review';
create index volunteer_hours_mentor_date_idx on public.volunteer_hours (mentor_id, date);
create index volunteer_hours_student_idx on public.volunteer_hours (student_id);

-- ---------------------------------------------------------------------------------------------
-- Reference
-- ---------------------------------------------------------------------------------------------
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 200),
  place       text not null check (length(place) <= 200),
  degree      text not null check (length(degree) <= 50),
  country     text not null check (country in ('Canada', 'US')),
  casper      boolean not null default false,
  interview   text check (length(interview) <= 200),
  url         text check (url ~ '^https://' and length(url) <= 2048),
  -- FE School.coordinates, for the globe on the requirements page.
  latitude    numeric(8, 5) check (latitude between -90 and 90),
  longitude   numeric(8, 5) check (longitude between -180 and 180),
  facts       jsonb not null default '[]' check (jsonb_typeof(facts) = 'array'),
  verified_at date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (name, place),
  check ((latitude is null) = (longitude is null))
);
create trigger schools_updated_at before update on public.schools
  for each row execute function public.set_updated_at();

-- Admin actions. Append-only.
create table public.audit_log (
  id       bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action   text not null check (length(action) between 1 and 100),
  target   text check (length(target) <= 500),
  at       timestamptz not null default now()
);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_at_idx on public.audit_log (at);
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function public.reject_change();

-- ---------------------------------------------------------------------------------------------
-- RLS on, no policies.
-- ---------------------------------------------------------------------------------------------
alter table public.chapter_progress enable row level security;
alter table public.assignments      enable row level security;
alter table public.submissions      enable row level security;
alter table public.submission_items enable row level security;
alter table public.reviews          enable row level security;
alter table public.events           enable row level security;
alter table public.volunteer_hours  enable row level security;
alter table public.schools          enable row level security;
alter table public.audit_log        enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;
