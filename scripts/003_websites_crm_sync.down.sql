-- Rollback for scripts/003_websites_crm_sync.sql. NOT APPLIED.
--
-- Leaves migration 002 exactly as it was. LOSSY, by design:
--   * Drops the alert outbox (undelivered owner alerts are lost), the email
--     leases and the queue pause state.
--   * Drops the retry columns: next attempt time, failure category/step/
--     outcome, rate-limit wait, warnings, sync time, needs-attention reason,
--     manual requeue count.
--   * needs_attention rows become crm_failed, the only 002 status that
--     still means "not synced".
-- Inquiry fields, consent evidence, CRM ids, crm_attempts and last_error
-- are kept.
--
-- Before running: stop the CRM sync scheduler, and export
-- website_crm_sync_alerts and the needs_attention rows if they matter.

begin;

do $$
begin
  if to_regclass('public.website_crm_sync_leases') is null then
    raise exception '003 is not applied';
  end if;
end $$;

-- No claim can commit between the guard below and the drops: take the table first.
-- Fail fast instead of queueing behind (and blocking) live app traffic.
set local lock_timeout = '5s';
-- State first, in the same order a claim touches the tables (state, then
-- inquiries, then leases), so a still-running claim can't deadlock with us.
lock table public.website_crm_sync_state in access exclusive mode;
lock table public.website_inquiries in access exclusive mode;
lock table public.website_crm_sync_leases in access exclusive mode;

do $$
begin
  if exists (select 1 from public.website_inquiries where claim_token is not null and claim_expires_at > now())
     or exists (select 1 from public.website_crm_sync_leases where expires_at > now()) then
    raise exception 'live CRM sync claims or reconcile-window leases exist; stop the scheduler and wait for them to expire';
  end if;
end $$;

drop function public.websites_crm_sync_health();
drop function public.websites_crm_requeue(uuid);
drop function public.websites_crm_release_claim(uuid, uuid);
drop function public.websites_crm_record_failure(uuid, uuid, text, text, text, text, boolean, bigint, text, jsonb);
drop function public.websites_crm_record_success(uuid, uuid, text, text, jsonb);
drop function public.websites_crm_claim(text, integer, uuid);
drop function public.websites_crm_email_key(text, uuid);

drop table public.website_crm_sync_alerts;
drop table public.website_crm_sync_leases;
drop table public.website_crm_sync_state;

alter table public.website_inquiries
  drop constraint website_inquiries_terminal_unclaimed,
  drop constraint website_inquiries_attention_has_reason,
  drop constraint website_inquiries_synced_has_ids,
  drop constraint website_inquiries_claim_consistent,
  drop constraint website_inquiries_attempts_nonnegative,
  drop constraint website_inquiries_warnings_array,
  drop constraint website_inquiries_outcome_check,
  drop constraint website_inquiries_failure_step_check,
  drop constraint website_inquiries_failure_category_check;

update public.website_inquiries set status = 'crm_failed' where status = 'needs_attention';

alter table public.website_inquiries drop constraint website_inquiries_status_check;
alter table public.website_inquiries
  add constraint website_inquiries_status_check
  check (status in ('received', 'crm_synced', 'crm_failed'));

-- Indexes on the dropped columns are dropped with them.
alter table public.website_inquiries
  drop column manual_requeues,
  drop column needs_attention_reason,
  drop column needs_attention_at,
  drop column crm_synced_at,
  drop column last_warnings,
  drop column rate_limited_until,
  drop column last_outcome,
  drop column last_failure_step,
  drop column last_failure_category,
  drop column last_attempt_at,
  drop column claim_expires_at,
  drop column claimed_by,
  drop column claim_token,
  drop column next_attempt_at;

commit;
