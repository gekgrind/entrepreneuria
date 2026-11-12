-- Rollback for scripts/002_websites_services.sql. NOT APPLIED.
-- Destroys all website inquiry, project, audit and payment-event rows.
-- Export website_inquiries first if any real inquiries exist.

begin;

drop table if exists public.website_payment_events;
drop table if exists public.website_project_events;
drop table if exists public.website_projects;
drop table if exists public.website_inquiries;

commit;
