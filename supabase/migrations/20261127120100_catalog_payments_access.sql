-- Catalog, payments and access (docs/architecture.md section 4 "Catalog and payments", section 5).
-- enrollments and credit_ledger are written only by access.service (D12).
-- Financial rows (orders) are never cascaded away: deleting a person with orders is a
-- deliberate admin step, not a side effect.

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind               text not null check (kind in ('package', 'module')),
  name               text not null check (length(name) between 1 and 200),
  stripe_price_id    text unique check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  review_credits     integer not null default 0 check (review_credits >= 0),
  one_on_one_credits integer not null default 0 check (one_on_one_credits >= 0),
  active             boolean not null default false,
  created_at         timestamptz not null default now(),
  -- A product can't be sold before it has a Stripe price.
  check (not active or stripe_price_id is not null)
);

create table public.product_modules (
  product_id  uuid not null references public.products (id) on delete cascade,
  module_slug text not null references public.program_modules (slug) on delete restrict,
  primary key (product_id, module_slug)
);
create index product_modules_module_idx on public.product_modules (module_slug);

-- One per Checkout Session. Pending orders hold a seat until expires_at (D7, D15, O2).
create table public.orders (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references public.profiles (id) on delete restrict,
  product_id                 uuid not null references public.products (id) on delete restrict,
  cohort_id                  uuid not null references public.cohorts (id) on delete restrict,
  stripe_checkout_session_id text unique check (stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  checkout_url               text check (checkout_url ~ '^https://'),
  stripe_payment_intent_id   text check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  amount_total               integer check (amount_total >= 0),
  currency                   text check (currency ~ '^[a-z]{3}$'),
  status                     text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'expired')),
  expires_at                 timestamptz not null,
  over_capacity              boolean not null default false,
  paid_at                    timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (status not in ('paid', 'refunded') or paid_at is not null)
);
create index orders_cohort_status_idx on public.orders (cohort_id, status);
create index orders_user_product_status_idx on public.orders (user_id, product_id, status);
create index orders_product_idx on public.orders (product_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Webhook idempotency (D6): inserted inside the fulfilment transaction.
create table public.stripe_events (
  id           text primary key check (id ~ '^evt_[A-Za-z0-9_]+$'),
  type         text not null,
  processed_at timestamptz not null default now()
);

-- Module access (D12, D22).
create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  module_slug text not null references public.program_modules (slug) on delete restrict,
  source      text not null check (source in ('purchase', 'hardship', 'admin')),
  order_id    uuid references public.orders (id) on delete restrict,
  granted_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (student_id, module_slug),
  -- Purchases point at their order; manual grants record who gave them (D22).
  check (source <> 'purchase' or order_id is not null)
);
create index enrollments_module_idx on public.enrollments (module_slug);
create index enrollments_order_idx on public.enrollments (order_id);
create index enrollments_granted_by_idx on public.enrollments (granted_by);

-- Review rounds and 1-on-1 credits (D12, D16). Balance = sum(delta) per (student, kind).
-- Append-only: a correction is a new row with the opposite delta.
-- review_id gets its foreign key in the learning migration, once reviews exists.
create table public.credit_ledger (
  id         bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('review', 'one_on_one')),
  delta      integer not null check (delta <> 0 and delta between -100 and 100),
  reason     text not null check (length(reason) between 1 and 500),
  order_id   uuid references public.orders (id) on delete restrict,
  review_id  uuid,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index credit_ledger_student_kind_idx on public.credit_ledger (student_id, kind);
create index credit_ledger_order_idx on public.credit_ledger (order_id);
create index credit_ledger_review_idx on public.credit_ledger (review_id);
create index credit_ledger_granted_by_idx on public.credit_ledger (granted_by);

create trigger credit_ledger_append_only before update or delete on public.credit_ledger
  for each row execute function public.reject_change();
create trigger credit_ledger_no_truncate before truncate on public.credit_ledger
  for each statement execute function public.reject_truncate();

-- Backstop for D16: a balance can never go below zero, even under concurrent debits.
-- The transaction-scoped advisory lock serialises writes per (student, kind), and because
-- each statement in READ COMMITTED takes a fresh snapshot, the sum after the lock sees every
-- debit committed before it. This relies on READ COMMITTED (the API's default): under
-- REPEATABLE READ the snapshot would predate the lock. access.service still takes the
-- student_profiles row lock for its own read-then-write logic.
create function public.check_credit_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('credit_ledger:' || new.student_id::text || ':' || new.kind, 0));
  if new.delta < 0 and (
    select coalesce(sum(delta), 0) from public.credit_ledger
    where student_id = new.student_id and kind = new.kind
  ) + new.delta < 0 then
    raise exception 'no % credits left', new.kind using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger credit_ledger_balance before insert on public.credit_ledger
  for each row execute function public.check_credit_balance();

alter table public.products        enable row level security;
alter table public.product_modules enable row level security;
alter table public.orders          enable row level security;
alter table public.stripe_events   enable row level security;
alter table public.enrollments     enable row level security;
alter table public.credit_ledger   enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;
