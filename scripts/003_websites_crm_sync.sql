-- Entrepreneuria Websites: durable CRM sync coordination (CRM sync recovery, Phase 1).
-- docs/websites/CRM-SYNC-RECOVERY-PLAN.md, review packet docs/websites/MIGRATION-REVIEW-003.md.
--
-- NOT APPLIED. Requires 002_websites_services.sql and separate owner approval.
-- Additive: 002 is unchanged. Rollback: 003_websites_crm_sync.down.sql.
--
-- What the database guarantees (across any number of app processes):
--   * At most one live claim per inquiry, and per email address, at a time.
--     Claims use FOR NO KEY UPDATE SKIP LOCKED, a non-blocking advisory
--     lock and a persisted email lease. Claimers never wait on each other.
--   * A result is recorded only by the worker holding the current claim
--     token. A worker whose claim expired cannot overwrite a newer one.
--   * Whenever GHL may have created something (success, ambiguous failure,
--     crash), neither the inquiry nor any sibling inquiry for the same email
--     syncs again until the reconcile floor (default 5 min) has passed, so
--     GHL's search index can catch up first.
--   * Attempts are capped (default 6). Rate limits and auth failures pause
--     the whole queue and don't use up an inquiry's attempts. Exhaustion and
--     terminal failures become `needs_attention` with an alert queued in
--     the same transaction.
--   * Cap, floor and lease live in website_crm_sync_state, so every caller
--     uses the same values.
-- What it cannot guarantee: exactly-once creation in GHL after an ambiguous
-- timeout. That is handled by the adapter's read-before-create
-- reconciliation (packet §5).
--
-- Supabase assumptions: roles anon, authenticated and service_role exist.
-- service_role bypasses RLS. New public functions get EXECUTE for anon and
-- authenticated through default privileges, so it is revoked below.

begin;

do $$
begin
  if to_regclass('public.website_inquiries') is null then
    raise exception '003 requires 002_websites_services.sql to be applied first';
  end if;
  if to_regclass('public.website_crm_sync_leases') is not null then
    raise exception '003 is already applied';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception '003 expects the Supabase service_role role';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. website_inquiries: sync state
-- ---------------------------------------------------------------------------

alter table public.website_inquiries drop constraint if exists website_inquiries_status_check;
alter table public.website_inquiries
  add constraint website_inquiries_status_check
  check (status in ('received', 'crm_synced', 'crm_failed', 'needs_attention'));

alter table public.website_inquiries
  add column next_attempt_at        timestamptz not null default now(),
  add column claim_token            uuid,
  add column claimed_by             text,
  add column claim_expires_at       timestamptz,
  add column last_attempt_at        timestamptz,
  add column last_failure_category  text,
  add column last_failure_step      text,
  add column last_outcome           text,
  add column rate_limited_until     timestamptz,
  add column last_warnings          jsonb not null default '[]'::jsonb,
  add column crm_synced_at          timestamptz,
  add column needs_attention_at     timestamptz,
  add column needs_attention_reason text,
  add column manual_requeues        integer not null default 0;

alter table public.website_inquiries
  add constraint website_inquiries_failure_category_check
    check (last_failure_category is null or last_failure_category in
      ('rate_limited', 'auth', 'rejected', 'config', 'server', 'network', 'unknown_outcome', 'internal')),
  add constraint website_inquiries_failure_step_check
    check (last_failure_step is null or last_failure_step in ('contact', 'tags', 'note', 'opportunity')),
  add constraint website_inquiries_outcome_check
    check (last_outcome is null or last_outcome in ('rejected', 'unknown')),
  add constraint website_inquiries_warnings_array
    check (jsonb_typeof(last_warnings) = 'array'),
  add constraint website_inquiries_attempts_nonnegative
    check (crm_attempts >= 0 and manual_requeues >= 0),
  add constraint website_inquiries_claim_consistent
    check ((claim_token is null) = (claim_expires_at is null) and (claim_token is null) = (claimed_by is null)),
  add constraint website_inquiries_synced_has_ids
    check (status <> 'crm_synced' or (crm_contact_id is not null and crm_opportunity_id is not null)),
  add constraint website_inquiries_attention_has_reason
    check (status <> 'needs_attention' or (needs_attention_at is not null and needs_attention_reason is not null)),
  add constraint website_inquiries_terminal_unclaimed
    check (status not in ('crm_synced', 'needs_attention') or claim_token is null);

-- Guard against a differently named status check surviving from 002.
do $$
begin
  if (select count(*) from pg_constraint
      where conrelid = 'public.website_inquiries'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) like '%crm_failed%') <> 1 then
    raise exception '003: expected exactly one status check constraint on website_inquiries';
  end if;
end $$;

create index website_inquiries_due_idx
  on public.website_inquiries (next_attempt_at)
  where status in ('received', 'crm_failed');

create index website_inquiries_attention_idx
  on public.website_inquiries (needs_attention_at)
  where status = 'needs_attention';


-- ---------------------------------------------------------------------------
-- 2. Coordination tables
-- ---------------------------------------------------------------------------

-- Persisted per-email lease: one live sync per email across all processes.
-- email_key = sha256(lower(trim(email))), so no plaintext email is stored here.
-- A lease outlives its sync until the reconcile floor whenever GHL may have
-- created something (success or ambiguous failure), so a sibling inquiry for
-- the same email never searches GHL before the index has caught up.
-- Expired rows are taken over in place (at most one row per email);
-- nothing deletes them in bulk.
create table public.website_crm_sync_leases (
  email_key    text primary key check (email_key ~ '^[0-9a-f]{64}$'),
  inquiry_id   uuid not null references public.website_inquiries (id) on delete cascade,
  claim_token  uuid not null,
  claimed_by   text not null,
  expires_at   timestamptz not null
);

-- Single row: queue-wide pause (GHL limits are per location) and the queue
-- settings, stored once so every caller uses the same cap, floor and lease.
create table public.website_crm_sync_state (
  id                       boolean primary key default true check (id),
  paused_until             timestamptz,
  pause_reason             text check (pause_reason is null or pause_reason in ('rate_limited', 'auth')),
  max_attempts             integer not null default 6   check (max_attempts between 1 and 10),
  lease_seconds            integer not null default 120 check (lease_seconds between 60 and 900),
  reconcile_floor_seconds  integer not null default 300 check (reconcile_floor_seconds between 60 and 3600),
  updated_at               timestamptz not null default now(),
  constraint website_crm_sync_state_floor_ge_lease check (reconcile_floor_seconds >= lease_seconds)
);
insert into public.website_crm_sync_state (id) values (true);

-- Owner-alert outbox for the signed webhook (A-12), with delivery tracking.
-- payload must not contain PII: ids, counts, categories and timestamps only.
create table public.website_crm_sync_alerts (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('needs_attention', 'auth_failure', 'stale_unsynced', 'worker_stalled', 'digest')),
  inquiry_id           uuid references public.website_inquiries (id) on delete set null,
  dedupe_key           text not null unique,
  payload              jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at           timestamptz not null default now(),
  delivery_status      text not null default 'pending' check (delivery_status in ('pending', 'delivered', 'failed')),
  delivery_attempts    integer not null default 0 check (delivery_attempts >= 0),
  next_delivery_at     timestamptz not null default now(),
  last_delivery_at     timestamptz,
  last_delivery_error  text,
  delivered_at         timestamptz,
  constraint website_crm_sync_alerts_delivered_at
    check ((delivery_status = 'delivered') = (delivered_at is not null))
);

create index website_crm_sync_alerts_pending_idx
  on public.website_crm_sync_alerts (next_delivery_at)
  where delivery_status = 'pending';

-- ---------------------------------------------------------------------------
-- 3. Functions (security invoker, empty search_path, everything qualified)
-- ---------------------------------------------------------------------------

create function public.websites_crm_email_key(p_email text, p_inquiry_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(pg_catalog.sha256(pg_catalog.convert_to(
    coalesce(nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), ''), 'inquiry:' || p_inquiry_id::text), 'UTF8')), 'hex');
$$;

-- Claim up to p_limit due inquiries for p_worker, at most one per email.
-- p_only_id restricts the claim to one inquiry (the Phase 2 fast path for a
-- just-stored inquiry); it is still claimed only if it is due and its email is free.
-- Callers must commit the claim before making any GHL request (PostgREST: POST /rpc).
create function public.websites_crm_claim(
  p_worker  text,
  p_limit   integer default 10,
  p_only_id uuid default null
)
returns setof public.website_inquiries
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  c        record;
  v_row    public.website_inquiries;
  v_token  uuid;
  v_taken  integer := 0;
  v_now    timestamptz := pg_catalog.clock_timestamp();
  v_cfg    public.website_crm_sync_state;
begin
  if p_worker is null or pg_catalog.length(p_worker) not between 1 and 100 then
    raise exception 'websites_crm_claim: invalid worker id';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'websites_crm_claim: p_limit must be 1..50';
  end if;

  select * into v_cfg from public.website_crm_sync_state s where s.id;
  if not found then raise exception 'websites_crm_claim: website_crm_sync_state row missing'; end if;

  -- Queue-wide pause (rate limit or auth failure).
  if v_cfg.paused_until > v_now then
    return;
  end if;

  -- An interrupted final attempt (claim expired, attempts already at the
  -- cap) can't be retried again: move it to needs_attention with an alert.
  with exhausted as (
    select i.id from public.website_inquiries i
    where i.status in ('received', 'crm_failed')
      and i.crm_attempts >= v_cfg.max_attempts
      and i.next_attempt_at <= v_now
      and (i.claim_expires_at is null or i.claim_expires_at < v_now)
      and (p_only_id is null or i.id = p_only_id)
    for no key update skip locked
  ), moved as (
    update public.website_inquiries i
       set status = 'needs_attention',
           needs_attention_at = v_now,
           needs_attention_reason = 'attempts_exhausted_interrupted',
           claim_token = null, claimed_by = null, claim_expires_at = null,
           updated_at = v_now
      from exhausted e
     where i.id = e.id
    returning i.id, i.crm_attempts, i.manual_requeues
  )
  insert into public.website_crm_sync_alerts (kind, inquiry_id, dedupe_key, payload)
  select 'needs_attention', m.id, 'needs_attention:' || m.id || ':' || m.manual_requeues || ':' || m.crm_attempts,
         pg_catalog.jsonb_build_object('reason', 'attempts_exhausted_interrupted', 'attempts', m.crm_attempts)
    from moved m
  on conflict (dedupe_key) do nothing;

  -- Candidates: the oldest due inquiry of each email whose lease is free
  -- (so one busy email can't fill the window and starve the rest), locked
  -- without waiting, then visited in email-key order. The advisory try-lock
  -- never blocks, and no statement here waits on another claimer's lease
  -- row, so concurrent claimers can't deadlock.
  for c in
    select locked.id, locked.email_key from (
      select i.id, k.email_key, k.next_attempt_at, k.submitted_at
        from (
          select distinct on (d.email_key) d.id, d.email_key, d.next_attempt_at, d.submitted_at
            from (
              select i2.id, public.websites_crm_email_key(i2.fields ->> 'email', i2.id) as email_key,
                     i2.next_attempt_at, i2.submitted_at
                from public.website_inquiries i2
               where i2.status in ('received', 'crm_failed')
                 and i2.crm_attempts < v_cfg.max_attempts
                 and i2.next_attempt_at <= v_now
                 and (i2.claim_expires_at is null or i2.claim_expires_at < v_now)
                 and (p_only_id is null or i2.id = p_only_id)
            ) d
           where not exists (select 1 from public.website_crm_sync_leases l
                              where l.email_key = d.email_key and l.expires_at >= v_now)
           order by d.email_key, d.next_attempt_at, d.submitted_at
        ) k
        join public.website_inquiries i on i.id = k.id
       -- Re-checked on the locked row version (READ COMMITTED re-evaluation).
       where i.status in ('received', 'crm_failed')
         and i.next_attempt_at <= v_now
         and (i.claim_expires_at is null or i.claim_expires_at < v_now)
       order by k.next_attempt_at, k.submitted_at
       limit p_limit
       for no key update of i skip locked
    ) locked
    order by locked.email_key
  loop
    exit when v_taken >= p_limit;

    if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('websites_crm:' || c.email_key, 0)) then
      continue; -- another claimer is handling this email right now
    end if;

    v_token := pg_catalog.gen_random_uuid();
    -- Takes the email's lease only if it is free or expired. Expired rows are
    -- taken over here (never deleted in bulk), always under this email's
    -- advisory lock.
    insert into public.website_crm_sync_leases as l (email_key, inquiry_id, claim_token, claimed_by, expires_at)
    values (c.email_key, c.id, v_token, p_worker, v_now + pg_catalog.make_interval(secs => v_cfg.reconcile_floor_seconds))
    on conflict (email_key) do update
      set inquiry_id = excluded.inquiry_id,
          claim_token = excluded.claim_token,
          claimed_by = excluded.claimed_by,
          expires_at = excluded.expires_at
      where l.expires_at < v_now;
    if not found then
      continue; -- leased by a live or just-finished sync of this email
    end if;

    update public.website_inquiries i
       set claim_token = v_token,
           claimed_by = p_worker,
           claim_expires_at = v_now + pg_catalog.make_interval(secs => v_cfg.lease_seconds),
           crm_attempts = i.crm_attempts + 1,
           last_attempt_at = v_now,
           -- Pessimistic: if this worker dies, the retry waits for the reconcile floor.
           next_attempt_at = v_now + pg_catalog.make_interval(secs => v_cfg.reconcile_floor_seconds),
           updated_at = v_now
     where i.id = c.id
    returning i.* into v_row;

    v_taken := v_taken + 1;
    return next v_row;
  end loop;
end;
$$;

-- Record success. Returns false if the claim is no longer current (stale worker).
-- The email lease is kept until the reconcile floor: a sibling inquiry for the
-- same email must not search for this opportunity before GHL has indexed it.
create function public.websites_crm_record_success(
  p_id             uuid,
  p_claim_token    uuid,
  p_contact_id     text,
  p_opportunity_id text,
  p_warnings       jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now   timestamptz := pg_catalog.clock_timestamp();
  v_floor integer;
begin
  if p_id is null or p_claim_token is null then
    raise exception 'websites_crm_record_success: id and claim token are required';
  end if;
  if coalesce(pg_catalog.btrim(p_contact_id), '') = '' or coalesce(pg_catalog.btrim(p_opportunity_id), '') = '' then
    raise exception 'websites_crm_record_success: contact and opportunity ids are required';
  end if;
  if p_warnings is null or pg_catalog.jsonb_typeof(p_warnings) <> 'array' then
    raise exception 'websites_crm_record_success: warnings must be a JSON array';
  end if;

  update public.website_inquiries i
     set status = 'crm_synced',
         crm_contact_id = p_contact_id,
         crm_opportunity_id = p_opportunity_id,
         crm_synced_at = v_now,
         last_warnings = p_warnings,
         last_error = null,
         last_failure_category = null,
         last_failure_step = null,
         last_outcome = null,
         claim_token = null, claimed_by = null, claim_expires_at = null,
         next_attempt_at = v_now,
         updated_at = v_now
   where i.id = p_id and i.claim_token = p_claim_token and i.status in ('received', 'crm_failed');
  if not found then
    return false;
  end if;

  select s.reconcile_floor_seconds into v_floor from public.website_crm_sync_state s where s.id;
  if v_floor is null then raise exception 'websites_crm_record_success: website_crm_sync_state row missing'; end if;
  update public.website_crm_sync_leases l
     set expires_at = v_now + pg_catalog.make_interval(secs => v_floor)
   where l.inquiry_id = p_id and l.claim_token = p_claim_token;
  return true;
end;
$$;

-- Record a failed attempt. Returns the resulting status, or 'stale_claim'.
-- p_retry_after_ms is capped at 24 h.
create function public.websites_crm_record_failure(
  p_id             uuid,
  p_claim_token    uuid,
  p_category       text,
  p_step           text,
  p_outcome        text,
  p_error          text,
  p_retryable      boolean,
  p_retry_after_ms bigint default null,
  p_contact_id     text default null,
  p_warnings       jsonb default '[]'::jsonb
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now      timestamptz := pg_catalog.clock_timestamp();
  v_cfg      public.website_crm_sync_state;
  v_row      public.website_inquiries;
  v_attempts integer;
  v_delay    interval;
  v_wait     interval;
  v_systemic boolean;
  v_terminal boolean;
  v_status   text;
begin
  -- Explicit checks, before any row is touched (NULL must never slip through).
  if p_id is null or p_claim_token is null then
    raise exception 'websites_crm_record_failure: id and claim token are required';
  end if;
  if p_category is null or p_category not in ('rate_limited', 'auth', 'rejected', 'config', 'server', 'network', 'unknown_outcome', 'internal') then
    raise exception 'websites_crm_record_failure: invalid category %', coalesce(p_category, 'NULL');
  end if;
  if p_step is null or p_step not in ('contact', 'tags', 'note', 'opportunity') then
    raise exception 'websites_crm_record_failure: invalid step %', coalesce(p_step, 'NULL');
  end if;
  if p_outcome is null or p_outcome not in ('rejected', 'unknown') then
    raise exception 'websites_crm_record_failure: invalid outcome %', coalesce(p_outcome, 'NULL');
  end if;
  if p_retryable is null then
    raise exception 'websites_crm_record_failure: p_retryable is required';
  end if;
  if p_warnings is null or pg_catalog.jsonb_typeof(p_warnings) <> 'array' then
    raise exception 'websites_crm_record_failure: warnings must be a JSON array';
  end if;

  select * into v_cfg from public.website_crm_sync_state s where s.id;
  if not found then raise exception 'websites_crm_record_failure: website_crm_sync_state row missing'; end if;
  v_wait := pg_catalog.make_interval(secs => least(greatest(coalesce(p_retry_after_ms, 0), 0), 86400000) / 1000.0);
  v_systemic := p_category in ('rate_limited', 'auth');

  select * into v_row from public.website_inquiries i
   where i.id = p_id and i.claim_token = p_claim_token and i.status in ('received', 'crm_failed')
   for no key update;
  if not found then
    return 'stale_claim';
  end if;

  -- A systemic failure (429 / auth) gives the attempt back and pauses the queue.
  -- Refunds are unbounded on purpose: a persistent 429/auth problem keeps the
  -- queue paused (with hourly auth alerts) rather than exhausting every inquiry.
  v_attempts := case when v_systemic then greatest(v_row.crm_attempts - 1, 0) else v_row.crm_attempts end;
  v_terminal := not v_systemic and (not p_retryable or v_attempts >= v_cfg.max_attempts);

  -- A-13 backoff after attempt n: 1 m, 5 m, 30 m, 2 h, then 12 h.
  v_delay := case v_attempts
               when 0 then interval '1 minute'
               when 1 then interval '1 minute'
               when 2 then interval '5 minutes'
               when 3 then interval '30 minutes'
               when 4 then interval '2 hours'
               else interval '12 hours'
             end;
  v_delay := greatest(v_delay, v_wait);
  if p_outcome = 'unknown' and p_step in ('note', 'opportunity') then
    v_delay := greatest(v_delay, pg_catalog.make_interval(secs => v_cfg.reconcile_floor_seconds));
  end if;
  if p_category = 'auth' then
    v_delay := greatest(v_delay, interval '15 minutes');
  end if;

  v_status := case when v_terminal then 'needs_attention' else 'crm_failed' end;

  update public.website_inquiries i
     set status = v_status,
         crm_attempts = v_attempts,
         crm_contact_id = coalesce(nullif(p_contact_id, ''), i.crm_contact_id),
         last_error = pg_catalog.left(p_error, 500),
         last_failure_category = p_category,
         last_failure_step = p_step,
         last_outcome = p_outcome,
         rate_limited_until = case when v_wait > interval '0' then v_now + v_wait else i.rate_limited_until end,
         last_warnings = p_warnings,
         next_attempt_at = case when v_terminal then i.next_attempt_at else v_now + v_delay end,
         needs_attention_at = case when v_terminal then v_now else null end,
         needs_attention_reason = case when v_terminal then
             case when not p_retryable then 'non_retryable:' || p_category else 'attempts_exhausted' end
           else null end,
         claim_token = null, claimed_by = null, claim_expires_at = null,
         updated_at = v_now
   where i.id = p_id;

  -- Email lease: if GHL may have created a note or opportunity (unknown outcome
  -- at those steps), keep it until the reconcile floor so siblings wait too.
  -- Contact upserts and tag adds converge on their own, so free it otherwise.
  if p_outcome = 'unknown' and p_step in ('note', 'opportunity') then
    update public.website_crm_sync_leases l
       set expires_at = v_now + pg_catalog.make_interval(secs => v_cfg.reconcile_floor_seconds)
     where l.inquiry_id = p_id and l.claim_token = p_claim_token;
  else
    delete from public.website_crm_sync_leases l where l.inquiry_id = p_id and l.claim_token = p_claim_token;
  end if;

  if v_systemic then
    update public.website_crm_sync_state s
       set paused_until = greatest(coalesce(s.paused_until, v_now), v_now + v_delay),
           pause_reason = p_category,
           updated_at = v_now
     where s.id;
  end if;

  if v_terminal then
    insert into public.website_crm_sync_alerts (kind, inquiry_id, dedupe_key, payload)
    values ('needs_attention', p_id, 'needs_attention:' || p_id || ':' || v_row.manual_requeues || ':' || v_attempts,
            pg_catalog.jsonb_build_object('category', p_category, 'step', p_step, 'attempts', v_attempts))
    on conflict (dedupe_key) do nothing;
  elsif p_category = 'auth' then
    insert into public.website_crm_sync_alerts (kind, dedupe_key, payload)
    values ('auth_failure', 'auth_failure:' || pg_catalog.to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24'),
            pg_catalog.jsonb_build_object('step', p_step))
    on conflict (dedupe_key) do nothing;
  end if;

  return v_status;
end;
$$;

-- Graceful shutdown: give back a claim that has NOT made any GHL request yet
-- (attempt refunded, retry now, lease freed). After any GHL request, record a
-- result instead.
create function public.websites_crm_release_claim(p_id uuid, p_claim_token uuid)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_id is null or p_claim_token is null then
    raise exception 'websites_crm_release_claim: id and claim token are required';
  end if;
  update public.website_inquiries i
     set crm_attempts = greatest(i.crm_attempts - 1, 0),
         next_attempt_at = v_now,
         claim_token = null, claimed_by = null, claim_expires_at = null,
         updated_at = v_now
   where i.id = p_id and i.claim_token = p_claim_token;
  if not found then
    return false;
  end if;
  delete from public.website_crm_sync_leases l where l.inquiry_id = p_id and l.claim_token = p_claim_token;
  return true;
end;
$$;

-- Owner action: put a needs_attention inquiry back in the queue with a fresh attempt budget.
create function public.websites_crm_requeue(p_id uuid)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_id is null then
    raise exception 'websites_crm_requeue: id is required';
  end if;
  update public.website_inquiries i
     set status = 'crm_failed',
         crm_attempts = 0,
         manual_requeues = i.manual_requeues + 1,
         needs_attention_at = null,
         needs_attention_reason = null,
         next_attempt_at = v_now,
         updated_at = v_now
   where i.id = p_id and i.status = 'needs_attention' and i.claim_token is null;
  return found;
end;
$$;

-- Counts only, no PII. For the protected health route (Phase 3).
create function public.websites_crm_sync_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'received',          (select count(*) from public.website_inquiries where status = 'received'),
    'retrying',          (select count(*) from public.website_inquiries where status = 'crm_failed'),
    'needs_attention',   (select count(*) from public.website_inquiries where status = 'needs_attention'),
    'claimed',           (select count(*) from public.website_inquiries where claim_token is not null and claim_expires_at >= now()),
    'expired_claims',    (select count(*) from public.website_inquiries where claim_token is not null and claim_expires_at < now()),
    'live_leases',       (select count(*) from public.website_crm_sync_leases where expires_at >= now()),
    'oldest_unsynced_minutes',
      (select floor(extract(epoch from (now() - min(submitted_at))) / 60)::integer
         from public.website_inquiries where status in ('received', 'crm_failed')),
    'paused_until',      (select paused_until from public.website_crm_sync_state where id),
    'pause_reason',      (select pause_reason from public.website_crm_sync_state where id),
    'max_attempts',      (select max_attempts from public.website_crm_sync_state where id),
    'alerts_pending',    (select count(*) from public.website_crm_sync_alerts where delivery_status = 'pending'),
    'alerts_failed',     (select count(*) from public.website_crm_sync_alerts where delivery_status = 'failed')
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Access control: service role only (same model as 002)
-- ---------------------------------------------------------------------------

alter table public.website_crm_sync_leases enable row level security;
alter table public.website_crm_sync_state  enable row level security;
alter table public.website_crm_sync_alerts enable row level security;

revoke all on public.website_crm_sync_leases, public.website_crm_sync_state, public.website_crm_sync_alerts
  from public, anon, authenticated;
grant select, insert, update, delete on public.website_crm_sync_leases, public.website_crm_sync_state,
  public.website_crm_sync_alerts to service_role;

revoke all on function public.websites_crm_email_key(text, uuid) from public, anon, authenticated;
revoke all on function public.websites_crm_claim(text, integer, uuid) from public, anon, authenticated;
revoke all on function public.websites_crm_record_success(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.websites_crm_record_failure(uuid, uuid, text, text, text, text, boolean, bigint, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.websites_crm_release_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.websites_crm_requeue(uuid) from public, anon, authenticated;
revoke all on function public.websites_crm_sync_health() from public, anon, authenticated;

grant execute on function public.websites_crm_email_key(text, uuid) to service_role;
grant execute on function public.websites_crm_claim(text, integer, uuid) to service_role;
grant execute on function public.websites_crm_record_success(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.websites_crm_record_failure(uuid, uuid, text, text, text, text, boolean, bigint, text, jsonb)
  to service_role;
grant execute on function public.websites_crm_release_claim(uuid, uuid) to service_role;
grant execute on function public.websites_crm_requeue(uuid) to service_role;
grant execute on function public.websites_crm_sync_health() to service_role;

commit;
