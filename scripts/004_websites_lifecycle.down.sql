-- Rollback for scripts/004_websites_lifecycle.sql. NOT APPLIED.
--
-- Leaves migration 002 (and 003) exactly as they were. LOSSY, by design:
--   * Drops website_project_rejections and website_communication_intents.
--   * Drops the pre-sale and payment-request columns on website_projects, the
--     idempotency key and mode on website_project_events, and the provenance
--     columns on website_payment_events. The audit rows themselves are kept.
-- Refuses to run if any project is in a state 002 does not know, or is a
-- production project: restoring 002's state check would orphan it. Close or
-- cancel such projects first, or export them.
--
-- Before running: stop anything that calls website_lifecycle_commit, and export
-- website_project_rejections if the owner review queue matters.

begin;

do $$
begin
  if to_regclass('public.website_project_rejections') is null then
    raise exception '004 is not applied';
  end if;
end $$;

set local lock_timeout = '5s';
lock table public.website_projects, public.website_project_events, public.website_payment_events in access exclusive mode;

do $$
begin
  if exists (select 1 from public.website_projects
              where state not in ('preview_requested', 'proposal_sent', 'approved', 'setup_payment_failed', 'setup_paid',
                                  'in_progress', 'customer_delay', 'customer_review', 'launch_approved', 'launch_failed',
                                  'live', 'past_due', 'cancellation_pending', 'canceled')
                 or mode <> 'sandbox') then
    raise exception 'projects exist in a state or mode that migration 002 cannot hold; close, cancel or export them first';
  end if;
end $$;

drop function public.website_lifecycle_commit(uuid, integer, jsonb, text, jsonb, jsonb, jsonb);

drop table public.website_communication_intents;
drop table public.website_project_rejections;

drop trigger website_payment_events_append_only on public.website_payment_events;
drop trigger website_project_events_append_only on public.website_project_events;
drop trigger website_projects_guard on public.website_projects;
drop function public.website_audit_append_only();
drop function public.website_projects_guard();

alter table public.website_payment_events
  drop constraint website_payment_events_provenance,
  drop column mode, drop column lifecycle_event, drop column attested, drop column body_sha256, drop column verified_at;

alter table public.website_project_events
  drop constraint website_project_events_project_event_uq,
  drop constraint website_project_events_event_id_len,
  drop constraint website_project_events_mode_check,
  drop column event_id, drop column mode;

drop index public.website_projects_setup_charge_uq;
drop index public.website_projects_setup_request_uq;

alter table public.website_projects
  drop constraint website_projects_no_production_money_yet,
  drop constraint website_projects_charge_after_payment,
  drop constraint website_projects_subscription_after_launch,
  drop constraint website_projects_version_check,
  drop constraint website_projects_attempts_check,
  drop constraint website_projects_json_shapes,
  drop constraint website_projects_closed_consistent,
  drop constraint website_projects_closed_reason_check,
  drop constraint website_projects_mode_check,
  drop constraint website_projects_state_check;

alter table public.website_projects
  drop column mode, drop column acknowledged_at, drop column qualified_at, drop column preview_started_at,
  drop column preview_deliveries, drop column revision_requests, drop column preview_approval, drop column proposal,
  drop column closed_at, drop column closed_reason, drop column setup_payment_request_id,
  drop column setup_payment_requested_at, drop column setup_payment_attempts, drop column launch_approval_evidence,
  drop column launch_verification, drop column version;

-- 002's constraints, restored exactly.
alter table public.website_projects
  add constraint website_projects_state_check
  check (state in (
    'preview_requested', 'proposal_sent', 'approved', 'setup_payment_failed',
    'setup_paid', 'in_progress', 'customer_delay', 'customer_review',
    'launch_approved', 'launch_failed', 'live', 'past_due',
    'cancellation_pending', 'canceled')),
  add constraint website_projects_subscription_after_launch
  check (subscription_id is null or (launched_at is not null and setup_paid_at is not null));

commit;
