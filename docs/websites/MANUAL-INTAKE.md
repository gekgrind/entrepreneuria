# Staged intake without GoHighLevel

This release candidate can use the existing private review directory for every
free preview request. It acknowledges requests only after durable storage.
The signed alert contains only a reference. It does not initialize a GHL client
or use Supabase or payments. The separate manual release gates are all closed.

For an isolated rehearsal, use `WEBSITES_SERVICES_MODE=leads` with
`WEBSITES_LEADS_DELIVERY=manual`, sandbox-only config and an evidence-gated
staging build. Never copy the staging config to production. Keep authorization
off and the production routes closed until the owner approves activation.

- One app process. Provision a dedicated review directory outside the web root
  and releases (owner: app user; mode 0700, files 0600). Confirm it persists
  across restarts and rehearse recovery. Do not point it at an unrelated directory.
- Configure the loopback alert receiver and the monitored inbox. Submit a
  synthetic staging inquiry and verify the stored record, reference-only inbox
  message, duplicate, capacity, pause, storage failure and receiver outage.
- Monitor the review queue on a schedule that meets the two-business-day reply
  promise, including when there is no new traffic. This is required even if
  email works. Open `NOT NOTIFIED` records over SSH using
  `scripts/websites-review.mts` and resolve them after handling. Do not paste
  records into logs, tickets, or chat. Agree on data retention and backup access.
- Leave GHL credentials out of this release environment. Do not run the
  Supabase websites migration for this mode. Confirm payment and SMS remain off.
- Emergency stop: set services mode to `off` in the active release and deploy
  source environment, restart only the web app, and check both routes return
  404. Leave the queue and monitored inbox intact for outstanding requests.
