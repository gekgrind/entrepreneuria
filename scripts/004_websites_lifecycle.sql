-- Entrepreneuria Websites: durable preview-to-payment lifecycle (persistence for PR #39).
-- docs/websites/WEBSITES_LIFECYCLE_STATE_MACHINE.md "Persistence delta",
-- review notes docs/websites/MIGRATION-REVIEW-004.md.
--
-- NOT APPLIED. Requires 002_websites_services.sql and separate owner approval.
-- Additive: 002 and 003 are unchanged. Independent of 003 (no shared objects).
-- Rollback: 004_websites_lifecycle.down.sql.
--
-- What the database guarantees, for any number of app processes:
--   * A lifecycle event is applied at most once per project (unique
--     project_id + event_id) and only against the version the caller read
--     (compare-and-set), inside one transaction that also writes the audit
--     row, the verified payment fact and the communication intents.
--   * One charge and one payment request belong to one project, ever.
--   * Money facts cannot be changed or cleared once recorded: setup charge,
--     subscription, payment time, launch time, launch verification.
--   * A subscription needs a recorded, verified launch.
--   * No production project can hold a charge or a subscription yet (no live
--     payment provider exists, D-07). Removing that guard is its own reviewed
--     migration, made when Gate B/C open.
--   * The audit trail and the payment-event ledger are append-only.
--   * A project's mode (sandbox or production) never changes.
--   * Only service_role can read or write any of it. anon and authenticated
--     get nothing; RLS stays enabled with no policies, as in 002.
-- What it cannot guarantee: that the app sends correct data. The pure state
-- machine (lib/services/websites/lifecycle.ts) decides what is allowed; this
-- migration makes the stored facts tamper-evident and race-free.
--
-- Backward compatibility: new columns have defaults, every 002 state remains
-- valid, and the two constraints that reach old columns are NOT VALID so a
-- 002-era row is never rewritten or rejected by the migration itself.

begin;

do $$
begin
  if to_regclass('public.website_projects') is null or to_regclass('public.website_payment_events') is null then
    raise exception '004 requires 002_websites_services.sql to be applied first';
  end if;
  if to_regclass('public.website_project_rejections') is not null then
    raise exception '004 is already applied';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception '004 expects the Supabase service_role role';
  end if;
end $$;

-- Fail fast instead of queueing behind live app traffic.
set local lock_timeout = '5s';
lock table public.website_projects, public.website_project_events, public.website_payment_events in access exclusive mode;

-- ---------------------------------------------------------------------------
-- 1. website_projects
-- ---------------------------------------------------------------------------

alter table public.website_projects drop constraint if exists website_projects_state_check;
alter table public.website_projects
  add constraint website_projects_state_check
  check (state in (
    'preview_requested', 'qualification_pending', 'qualified', 'preview_in_progress',
    'preview_sent', 'revision_requested', 'preview_approved', 'proposal_sent', 'proposal_expired',
    'approved', 'setup_payment_pending', 'setup_payment_failed', 'setup_paid',
    'in_progress', 'customer_delay', 'customer_review', 'launch_approved', 'launch_failed',
    'live', 'past_due', 'cancellation_pending', 'canceled', 'closed'));

alter table public.website_projects
  add column mode                       text        not null default 'sandbox',
  add column acknowledged_at            timestamptz,
  add column qualified_at               timestamptz,
  add column preview_started_at         timestamptz,
  add column preview_deliveries         jsonb       not null default '[]'::jsonb,
  add column revision_requests          jsonb       not null default '[]'::jsonb,
  add column preview_approval           jsonb,
  add column proposal                   jsonb,
  add column closed_at                  timestamptz,
  add column closed_reason              text,
  add column setup_payment_request_id   text,
  add column setup_payment_requested_at timestamptz,
  add column setup_payment_attempts     integer     not null default 0,
  add column launch_approval_evidence   jsonb,
  add column launch_verification        jsonb,
  add column version                    integer     not null default 0;

alter table public.website_projects
  add constraint website_projects_mode_check check (mode in ('sandbox', 'production')),
  add constraint website_projects_closed_reason_check
    check (closed_reason is null or closed_reason in
      ('disqualified', 'prospect_declined', 'abandoned', 'withdrawn_by_prospect', 'duplicate_request')),
  add constraint website_projects_closed_consistent
    check ((state = 'closed') = (closed_reason is not null and closed_at is not null)),
  add constraint website_projects_json_shapes
    check (jsonb_typeof(preview_deliveries) = 'array' and jsonb_typeof(revision_requests) = 'array'),
  add constraint website_projects_attempts_check check (setup_payment_attempts >= 0),
  add constraint website_projects_version_check check (version >= 0);

-- One charge and one payment request belong to one project, ever.
create unique index website_projects_setup_charge_uq
  on public.website_projects (setup_charge_id) where setup_charge_id is not null;
create unique index website_projects_setup_request_uq
  on public.website_projects (setup_payment_request_id) where setup_payment_request_id is not null;

-- Subscription needs a verified launch (tightens 002's constraint). NOT VALID: a 002-era row is not
-- re-checked by the migration; it is checked the next time it is updated.
alter table public.website_projects drop constraint website_projects_subscription_after_launch;
alter table public.website_projects
  add constraint website_projects_subscription_after_launch
  check (subscription_id is null
         or (launched_at is not null and setup_paid_at is not null and launch_verification is not null)) not valid,
  add constraint website_projects_charge_after_payment
  check (setup_charge_id is null or (setup_paid_at is not null and setup_payment_request_id is not null)) not valid,
  -- No live payment provider exists (D-07). A production project cannot hold money facts.
  add constraint website_projects_no_production_money_yet
  check (mode = 'sandbox' or (setup_charge_id is null and subscription_id is null)) not valid;

create function public.website_projects_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.mode is distinct from old.mode then
    raise exception 'website_projects.mode is fixed at creation' using errcode = 'restrict_violation';
  end if;
  if new.id is distinct from old.id or new.inquiry_id is distinct from old.inquiry_id then
    raise exception 'website_projects.id and inquiry_id are fixed' using errcode = 'restrict_violation';
  end if;
  -- Money and legal facts, once recorded, are never changed or cleared.
  if (old.setup_charge_id is not null and new.setup_charge_id is distinct from old.setup_charge_id)
     or (old.setup_paid_at is not null and new.setup_paid_at is distinct from old.setup_paid_at)
     or (old.subscription_id is not null and new.subscription_id is distinct from old.subscription_id)
     or (old.launched_at is not null and new.launched_at is distinct from old.launched_at)
     or (old.launch_verification is not null and new.launch_verification is distinct from old.launch_verification)
     or (old.preview_approval is not null and new.preview_approval is distinct from old.preview_approval)
     or (old.acceptance is not null and new.acceptance is distinct from old.acceptance)
     or (old.approved_at is not null and new.approved_at is distinct from old.approved_at)
  then
    raise exception 'recorded payment, launch and agreement facts cannot be changed' using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create trigger website_projects_guard
  before update on public.website_projects
  for each row execute function public.website_projects_guard();

-- ---------------------------------------------------------------------------
-- 2. website_project_events: idempotency key, mode, append-only
-- ---------------------------------------------------------------------------

-- Existing rows get a unique synthetic id; the default is then dropped so every new writer must supply one.
alter table public.website_project_events
  add column event_id text not null default gen_random_uuid()::text,
  add column mode     text not null default 'sandbox';
alter table public.website_project_events
  alter column event_id drop default,
  alter column mode drop default;
alter table public.website_project_events
  add constraint website_project_events_mode_check check (mode in ('sandbox', 'production')),
  add constraint website_project_events_event_id_len check (char_length(event_id) between 1 and 200),
  add constraint website_project_events_project_event_uq unique (project_id, event_id);

create function public.website_audit_append_only() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'restrict_violation';
end $$;

create trigger website_project_events_append_only
  before update or delete on public.website_project_events
  for each row execute function public.website_audit_append_only();

-- ---------------------------------------------------------------------------
-- 3. website_payment_events: provenance of every accepted payment fact
-- ---------------------------------------------------------------------------

-- One row per ACCEPTED provider fact (first receipt wins; the primary key is the provider's event id).
-- Rejected callbacks go to website_project_rejections so a transient rejection never blocks a redelivery.
alter table public.website_payment_events
  add column mode            text,
  add column lifecycle_event text,
  add column attested        jsonb,
  add column body_sha256     text,
  add column verified_at     timestamptz;
alter table public.website_payment_events
  add constraint website_payment_events_provenance
  -- Every term is explicitly NOT NULL: a CHECK passes when its expression is NULL.
  check (mode is not null and mode in ('sandbox', 'production')
         and lifecycle_event is not null
         and lifecycle_event in ('setup_payment_succeeded', 'setup_payment_failed', 'subscription_activated',
                                 'subscription_payment_failed', 'subscription_payment_recovered')
         and attested is not null and jsonb_typeof(attested) = 'object'
         and body_sha256 is not null and body_sha256 ~ '^[0-9a-f]{64}$'
         and verified_at is not null
         and project_id is not null) not valid;

create trigger website_payment_events_append_only
  before update or delete on public.website_payment_events
  for each row execute function public.website_audit_append_only();

-- ---------------------------------------------------------------------------
-- 4. New tables
-- ---------------------------------------------------------------------------

create table public.website_project_rejections (
  id          bigint generated always as identity primary key,
  event_id    text        not null check (char_length(event_id) <= 200),
  project_id  text        not null check (char_length(project_id) <= 200),
  event       text        not null check (char_length(event) <= 200),
  actor       text        not null check (char_length(actor) <= 200),
  at          text        not null check (char_length(at) <= 40),
  code        text        not null check (code in ('invalid_envelope', 'unknown_project', 'actor_not_permitted',
                                                   'unverified_provenance', 'invalid_transition',
                                                   'possible_double_payment', 'conflicting_duplicate')),
  reason      text        not null check (char_length(reason) <= 300),
  recorded_at timestamptz not null default now()
);
create index website_project_rejections_project_idx on public.website_project_rejections (project_id, recorded_at desc);
create index website_project_rejections_review_idx on public.website_project_rejections (recorded_at desc)
  where code in ('possible_double_payment', 'conflicting_duplicate', 'unverified_provenance');

create trigger website_project_rejections_append_only
  before update or delete on public.website_project_rejections
  for each row execute function public.website_audit_append_only();

-- What is due to be said to a customer. Never a send queue: `delivery` can only be 'not_sent'
-- until a later reviewed migration (Gate D) changes that.
create table public.website_communication_intents (
  id               bigint generated always as identity primary key,
  project_id       uuid        not null references public.website_projects (id),
  template_id      text        not null check (char_length(template_id) between 1 and 100),
  trigger_event_id text        not null check (char_length(trigger_event_id) between 1 and 200),
  mode             text        not null check (mode in ('sandbox', 'production')),
  due_at           timestamptz not null,
  delivery         text        not null default 'not_sent' check (delivery = 'not_sent'),
  created_at       timestamptz not null default now(),
  unique (project_id, template_id, trigger_event_id)
);

alter table public.website_project_rejections   enable row level security;
alter table public.website_communication_intents enable row level security;

revoke all on public.website_project_rejections, public.website_communication_intents from anon, authenticated;
revoke all on function public.website_projects_guard(), public.website_audit_append_only() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Atomic commit: the LifecycleStore.commit contract (workflow.ts)
-- ---------------------------------------------------------------------------

-- p_project is the full next row as jsonb (snake_case column names). Every mutable column must be present:
-- a missing key would silently null a column, so it is refused. Returns 'committed', 'event_exists' or
-- 'version_conflict'. Raises (and so rolls back everything) on any other problem, including a charge,
-- request or provider event id that already belongs to another project.
create function public.website_lifecycle_commit(
  p_project_id       uuid,
  p_expected_version integer,
  p_project          jsonb,
  p_event_id         text,
  p_audit            jsonb,
  p_payment          jsonb,
  p_intents          jsonb
) returns text
language plpgsql set search_path = public, pg_temp as $$
declare
  cur public.website_projects;
  nxt public.website_projects;
  required_keys constant text[] := array[
    'state', 'package_id', 'acceptance', 'setup_charge_id', 'subscription_id', 'delayed_from', 'approved_at',
    'setup_paid_at', 'implementation_started_at', 'launch_approved_at', 'launched_at', 'cancellation_requested_at',
    'cancellation_effective_at', 'canceled_at', 'acknowledged_at', 'qualified_at', 'preview_started_at',
    'preview_deliveries', 'revision_requests', 'preview_approval', 'proposal', 'closed_at', 'closed_reason',
    'setup_payment_request_id', 'setup_payment_requested_at', 'setup_payment_attempts', 'launch_approval_evidence',
    'launch_verification'];
begin
  -- A NULL would make `cur.version <> p_expected_version` NULL, i.e. neither true nor false, and the
  -- guard would be skipped. Refuse it (and negatives) before taking any lock.
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'expected version must be a non-negative integer';
  end if;
  if p_event_id is null or char_length(p_event_id) not between 1 and 200 then
    raise exception 'event id required (1-200 characters)';
  end if;
  if p_project is null or jsonb_typeof(p_project) <> 'object' or not (p_project ?& required_keys) then
    raise exception 'p_project must be an object carrying every mutable project column';
  end if;

  -- The row lock serializes concurrent commits for one project.
  select * into cur from public.website_projects where id = p_project_id for update;
  if not found then raise exception 'unknown project %', p_project_id; end if;

  if exists (select 1 from public.website_project_events where project_id = p_project_id and event_id = p_event_id) then
    return 'event_exists';
  end if;
  if cur.version is distinct from p_expected_version then return 'version_conflict'; end if;

  nxt := jsonb_populate_record(cur, p_project);   -- keys absent from p_project keep their current value
  update public.website_projects set
    state = nxt.state, package_id = nxt.package_id, acceptance = nxt.acceptance,
    setup_charge_id = nxt.setup_charge_id, subscription_id = nxt.subscription_id, delayed_from = nxt.delayed_from,
    approved_at = nxt.approved_at, setup_paid_at = nxt.setup_paid_at,
    implementation_started_at = nxt.implementation_started_at, launch_approved_at = nxt.launch_approved_at,
    launched_at = nxt.launched_at, cancellation_requested_at = nxt.cancellation_requested_at,
    cancellation_effective_at = nxt.cancellation_effective_at, canceled_at = nxt.canceled_at,
    acknowledged_at = nxt.acknowledged_at, qualified_at = nxt.qualified_at, preview_started_at = nxt.preview_started_at,
    preview_deliveries = nxt.preview_deliveries, revision_requests = nxt.revision_requests,
    preview_approval = nxt.preview_approval, proposal = nxt.proposal, closed_at = nxt.closed_at,
    closed_reason = nxt.closed_reason, setup_payment_request_id = nxt.setup_payment_request_id,
    setup_payment_requested_at = nxt.setup_payment_requested_at, setup_payment_attempts = nxt.setup_payment_attempts,
    launch_approval_evidence = nxt.launch_approval_evidence, launch_verification = nxt.launch_verification,
    version = cur.version + 1, updated_at = now()
  where id = p_project_id;

  insert into public.website_project_events (project_id, event_id, event, from_state, to_state, actor, detail, at, mode)
  values (p_project_id, p_event_id, p_audit ->> 'event', p_audit ->> 'from', p_audit ->> 'to', p_audit ->> 'actor',
          p_audit -> 'detail', (p_audit ->> 'at')::timestamptz, cur.mode);

  if p_payment is not null then
    insert into public.website_payment_events
      (provider_event_id, provider, type, project_id, mode, lifecycle_event, attested, body_sha256, verified_at)
    values (p_event_id, p_payment ->> 'provider', p_payment ->> 'type', p_project_id, cur.mode,
            p_audit ->> 'event', p_payment -> 'attested', p_payment ->> 'body_sha256', (p_payment ->> 'verified_at')::timestamptz);
  end if;

  if p_intents is not null and jsonb_typeof(p_intents) = 'array' and jsonb_array_length(p_intents) > 0 then
    insert into public.website_communication_intents (project_id, template_id, trigger_event_id, mode, due_at)
    select p_project_id, i ->> 'template_id', p_event_id, cur.mode, (i ->> 'due_at')::timestamptz
      from jsonb_array_elements(p_intents) i
    on conflict (project_id, template_id, trigger_event_id) do nothing;
  end if;

  return 'committed';
end $$;

revoke all on function public.website_lifecycle_commit(uuid, integer, jsonb, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.website_lifecycle_commit(uuid, integer, jsonb, text, jsonb, jsonb, jsonb) to service_role;

commit;
