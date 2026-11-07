-- Entrepreneuria Websites — inquiry store, project lifecycle, billing audit.
-- Spec v1.0 (2026-11-06) §4, §8, §10D, §10F.
--
-- NOT APPLIED. Requires owner approval before running against any Supabase
-- project (decision register D-03). Service-role access only: RLS is
-- enabled with no policies, so anon/authenticated clients cannot read or
-- write these tables.

begin;

create table if not exists public.website_inquiries (
  id                 uuid primary key default gen_random_uuid(),
  idempotency_key    uuid not null unique,
  status             text not null default 'received'
                     check (status in ('received', 'crm_synced', 'crm_failed')),
  fields             jsonb not null,
  consent            jsonb not null,   -- sms_consent, recorded_at, disclosure versions, page_url, ip_hash, user_agent
  policy_versions    jsonb not null,
  pricing_version    text not null,
  utm                jsonb,
  submitted_at       timestamptz not null,
  crm_contact_id     text,
  crm_opportunity_id text,
  crm_attempts       integer not null default 0,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists website_inquiries_status_idx on public.website_inquiries (status, submitted_at desc);
create index if not exists website_inquiries_email_idx on public.website_inquiries ((fields ->> 'email'));

create table if not exists public.website_projects (
  id                         uuid primary key default gen_random_uuid(),
  inquiry_id                 uuid references public.website_inquiries (id),
  state                      text not null default 'preview_requested'
                             check (state in (
                               'preview_requested', 'proposal_sent', 'approved', 'setup_payment_failed',
                               'setup_paid', 'in_progress', 'customer_delay', 'customer_review',
                               'launch_approved', 'launch_failed', 'live', 'past_due',
                               'cancellation_pending', 'canceled')),
  package_id                 text check (package_id in ('starter', 'growth', 'business')),
  acceptance                 jsonb,       -- AcceptanceRecord: policy + pricing versions, prices, timestamp
  setup_charge_id            text,
  subscription_id            text unique,
  delayed_from               text,
  approved_at                timestamptz,
  setup_paid_at              timestamptz,
  implementation_started_at  timestamptz,
  launch_approved_at         timestamptz,
  launched_at                timestamptz,
  cancellation_requested_at  timestamptz,
  cancellation_effective_at  timestamptz,
  canceled_at                timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  -- Billing may never be anchored before launch.
  constraint website_projects_subscription_after_launch
    check (subscription_id is null or (launched_at is not null and setup_paid_at is not null))
);

create table if not exists public.website_project_events (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references public.website_projects (id),
  event       text not null,
  from_state  text not null,
  to_state    text not null,
  actor       text not null,
  detail      jsonb,
  at          timestamptz not null default now()
);

create index if not exists website_project_events_project_idx on public.website_project_events (project_id, at);

create table if not exists public.website_payment_events (
  provider_event_id text primary key,
  provider          text not null,
  type              text not null,
  project_id        uuid references public.website_projects (id),
  received_at       timestamptz not null default now()
);

alter table public.website_inquiries      enable row level security;
alter table public.website_projects       enable row level security;
alter table public.website_project_events enable row level security;
alter table public.website_payment_events enable row level security;

revoke all on public.website_inquiries, public.website_projects,
              public.website_project_events, public.website_payment_events
  from anon, authenticated;

commit;
