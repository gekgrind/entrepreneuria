-- LOCAL TEST HARNESS ONLY. Asserts after the parallel run.
\set ON_ERROR_STOP on
\set QUIET on
do $$
declare v_dupe_synced int; v_mismatch int; v_claims int; v_synced int; v_viol int; v_samples bigint;
begin
  select count(*) into v_viol from t.violations;
  select coalesce(sum(n), 0) into v_samples from t.samples;
  perform t.ok(v_samples > 20, format('sampler ran (%s samples)', v_samples));
  perform t.ok(v_viol = 0, format('never two live claims for one email (%s violations)', v_viol));

  -- Every claim token is unique: no inquiry was handed to two workers at once.
  perform t.ok((select count(*) = count(distinct claim_token) from t.claims), 'every claim token unique');

  -- Exactly one success per synced inquiry; DB status agrees with the workers.
  select count(*) into v_dupe_synced from (select inquiry_id from t.claims where result = 'synced' group by 1 having count(*) > 1) d;
  perform t.ok(v_dupe_synced = 0, 'no inquiry recorded as synced twice');
  select count(*) into v_mismatch from public.website_inquiries i
   where (i.status = 'crm_synced') <> exists (select 1 from t.claims c where c.inquiry_id = i.id and c.result = 'synced');
  perform t.ok(v_mismatch = 0, 'crm_synced rows match successful records exactly');

  select count(*) into v_claims from t.claims;
  select count(*) into v_synced from public.website_inquiries where status = 'crm_synced';
  perform t.ok(v_claims > 200 and v_synced > 100, format('real contention exercised (%s claims, %s synced)', v_claims, v_synced));
  perform t.ok((select count(*) from t.claims where result = 'stale') = 0, 'no stale records in a run without lease expiry');
  perform t.ok((select count(*) from public.website_inquiries where claim_token is not null) = 0, 'no claims left behind');
  perform t.ok((select count(*) from public.website_crm_sync_leases where expires_at > now()) = 0, 'no live leases left behind');
end $$;
\echo 'CONCURRENCY: ALL PASSED'
