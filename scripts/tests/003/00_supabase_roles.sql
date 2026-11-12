-- LOCAL TEST HARNESS ONLY. Never run against Supabase.
-- Recreates the parts of Supabase's role model that 002/003 depend on:
-- anon/authenticated/service_role, service_role BYPASSRLS, and the default
-- privileges Supabase sets in schema public, which give anon and
-- authenticated access to new tables and functions unless revoked.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
