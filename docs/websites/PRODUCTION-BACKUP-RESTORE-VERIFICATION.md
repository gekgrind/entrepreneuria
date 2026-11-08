# Production backup and restore verification (gate G-B)

**Status: approved procedure (documentation). Not run.** Running it needs, separately:
- the production-backup approval in `PRODUCTION-MIGRATION-RUNBOOK-002-003.md` §10 (including the dump connection);
- approval to install the tools listed in A.1.

These are the exact steps for runbook gate G-B (§1). The owner runs them on their own machine.
- Claude doesn't run them, and doesn't receive the dumps, the password, restore logs, or anything with row contents.
- Only fingerprint *comparison results* (pass/fail, and section/object names of differences) and checksums are shared back, and only if the owner chooses to.

**A successful exit code doesn't prove a backup is complete.** The backup counts as complete only when step G passes: the encrypted archive, decrypted and restored into a disposable database, fingerprints the same as production.

**Decisions needed before starting:**
1. **Connection for the dump.** The Supabase CLI runs `pg_dump` in Docker. Docker on this machine has no IPv6 egress, and the direct connection is IPv6-only.
   - **(a) Session pooler (recommended).** Supavisor session mode, IPv4, port 5432; *not* the transaction pooler on 6543. Supabase's CLI backup guide uses the session pooler by default. Session mode keeps one server connection for the whole client session, which `pg_dump` needs; `pg_dump` here uses a single connection. Read-only use.
   - **(b) Enable IPv6 in Docker Desktop** (local setting), then use the direct connection.
   - The fingerprint runs use native `psql` over the direct connection either way.
2. **Restore target.** **(T1) local Supabase stack (recommended)** or **(T2) bare Postgres image.** See F.4.
3. **Archive locations.** Two, at least one off this machine. Only the encrypted archive leaves the machine, to owner-controlled offline media or one owner-named encrypted store.
4. **Retention.** Runbook G-B.3: the earliest of 30 days after 003 is stable, 30 days after a decision not to apply 003, and 60 days after the dump.

Commands are for Git Bash on Windows. Each command goes in its own code block, to run one at a time.

## What the five-file dump covers, and what it doesn't

**Covered**, within the CLI's supported scope (Supabase CLI reference, "db dump"; "Backup and Restore using the CLI"):

| File | Command flags | Contains |
|---|---|---|
| `prod-roles.sql` | `--role-only` | Custom roles and their memberships. Reserved Supabase roles are stripped. |
| `prod-schema.sql` | (default) | Every non-managed schema (`public`, `channelwright`, `prospra_private` and so on): tables, columns, constraints, indexes, views, sequences, types, functions, triggers, RLS policies and grants. The CLI excludes `auth`, `storage` and extension-created schemas. |
| `prod-data.sql` | `--use-copy --data-only` | Row data, **including `auth.users` and other `auth`/`storage` table rows** (Supabase's restore guide), and sequence positions |
| `prod-history-schema.sql`, `prod-history-data.sql` | `--schema supabase_migrations` | The CLI migration history the Architecta, Channelwright and Prospra repos depend on |

**Not covered** (record these in step B; they'd have to be rebuilt by hand):
- **Structure of Supabase-managed schemas** (`auth`, `storage`, `realtime`, `vault`, `graphql`, `extensions` and so on). The platform owns it; a restore target supplies its own version.
- **Reserved roles:** their attributes, settings (for example `authenticator` timeouts and `pgrst.*`) and memberships. Also **database-level settings** (`ALTER DATABASE … SET`).
- **Passwords of any role.**
- **Secrets:** JWT secret and API keys; Vault secret values. Vault rows are dumped, but encrypted with this project's key, so another database can't use them.
- **Storage files** (only their metadata rows are in the dump), **Edge Functions**.
- **Platform configuration:** Auth providers, SMTP, redirect URLs, hooks; Data API settings; network restrictions; SSL enforcement; custom domains; compute and pooler settings; extension enablement on a new project.
- **Custom event triggers and the `supabase_realtime` publication's table list.** The CLI comments these out of the schema dump. The fingerprint lists both, so record them in step B; they would be re-created by hand.
- **Large objects** (`pg_largeobject`). The fingerprint counts them; none are expected.

## A. Prepare (about 20 min, once)

**1. Install the tools** (needs approval):
- PostgreSQL **17** command-line tools: in the EDB installer, choose only "Command Line Tools". Add `C:\Program Files\PostgreSQL\17\bin` to PATH.
- The Supabase CLI (`npx supabase`; Node is installed).
- 7-Zip.
- Docker Desktop must be running.

Check them:
```bash
psql --version
```
```bash
npx supabase --version
```
`psql` must report **17.6 or later**. Newer `pg_dump` output contains `\restrict` lines that older 17.x clients reject.

**2. Use an encrypted, non-synced working folder.**
- It must be outside the repo and outside OneDrive, Dropbox and Google Drive, so plaintext is never uploaded.
- It should be on a BitLocker-encrypted drive. Check with `manage-bde -status` (PowerShell). On an SSD, deleting a file isn't guaranteed to erase it, so full-disk encryption is what protects deleted plaintext.
- **The drive holding Docker Desktop's disk image** (Settings → Resources → Advanced → Disk image location; usually on `C:`) must be BitLocker-encrypted too. The restored database lives inside that image, and deleting the container doesn't scrub it.
- If either drive isn't encrypted, **stop** and decide with the owner first.
```bash
mkdir -p /d/secure/ent-backup-$(date +%Y%m%d) && cd /d/secure/ent-backup-$(date +%Y%m%d)
```

**3. Turn shell history off. Take the fingerprint query from the committed tree and check its checksum** against runbook G0.3.
```bash
set +o history; export HISTFILE=/dev/null
```
```bash
git -C /c/DevProjects/entrepreneuria show HEAD:scripts/preflight/backup_fingerprint.sql > backup_fingerprint.sql && sha256sum backup_fingerprint.sql
```

**4. Enter the database password without echo.**
- It's the project's database password from your password manager. If you don't have it, **stop**: resetting it is a production change that needs its own approval, and deployed services must be checked first.
- `psql` reads it from `PGPASSWORD`, so the `psql` connection URLs contain no password.
```bash
read -rs PGPASSWORD; echo; export PGPASSWORD
```
- Only `supabase db dump` needs the password inside its URL, so make a URL-encoded copy for that alone. This is an accepted risk, recorded in runbook G-B.2: for the length of the dump the password is in that process's arguments and its container's environment.
```bash
DBPW_ENC=$(node -e "process.stdout.write(encodeURIComponent(process.env.PGPASSWORD))")
```

**5. Build the connection strings** in the shell only:
- **Direct, without a password**, for `psql`:
  ```bash
  export DIRECT_URL="postgresql://postgres@db.rifzbzaabkaeagyulxip.supabase.co:5432/postgres?sslmode=require"
  ```
- **Dump URL, with the password.** Option (a), the session pooler: copy the host **exactly** from the dashboard (Connect → Session pooler). It looks like `aws-?-us-west-2.pooler.supabase.com`; don't guess it. The user name is `postgres.rifzbzaabkaeagyulxip`.
  ```bash
  DUMP_URL="postgresql://postgres.rifzbzaabkaeagyulxip:${DBPW_ENC}@<session-pooler-host>:5432/postgres?sslmode=require"
  ```
  `DUMP_URL` is deliberately not exported, so child processes other than the dump commands never see it.

  Option (b), direct, with Docker IPv6 enabled:
  ```bash
  DUMP_URL="postgresql://postgres:${DBPW_ENC}@db.rifzbzaabkaeagyulxip.supabase.co:5432/postgres?sslmode=require"
  ```

**6. Read-only connection test** over the direct connection (runbook G0.8):
```bash
PGOPTIONS='-c default_transaction_read_only=on' psql -X "$DIRECT_URL" -At -c "select inet_server_addr(), inet_server_port(), current_user, current_setting('transaction_read_only')"
```
Expected: an **IPv6** address (it contains `:`), port `5432`, user `postgres`, `on`. The host in the URL is the proof; the IPv6 address supports it. If it fails, **stop**.

## B. Record the dashboard state (G-B.7 and the configuration inventory)

In the dashboard, record names and settings only, **never secret values**:

| Page | Record |
|---|---|
| Database → Backups (scheduled and point-in-time) | Whether any backup exists, its latest time and its type, or "not available on Free plan" |
| Settings → Add-ons | PITR / IPv4 / compute: on or off |
| Database → Extensions | Enabled extensions (also in the fingerprint) |
| Database → Publications | Tables in `supabase_realtime` (also in the fingerprint) |
| Authentication → Providers, URL configuration, SMTP, Hooks | Which providers are on, site URL and redirect URLs, SMTP on or off, hooks |
| Settings → API / Data API | Exposed schemas; legacy JWT or new API keys |
| Storage | Bucket names, public or private, file counts |
| Edge Functions | Function names and versions |
| Integrations → Vault | Secret **names** only, if any |
| Database → Roles | Reserved-role settings shown there (the fingerprint's `role_setting` lines show names and hashes) |

## C. First production fingerprint (read-only)

```bash
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=300s -c lock_timeout=2s' psql -X "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 -A -t -F '|' -f backup_fingerprint.sql > fp-prod-1.txt; echo "exit=$?"
```
Expected:
- `exit=0`.
- Lines beginning `database|`, `default_acl|`, `event_trigger|`, `extension|`, `large_objects|`, `meta|`, `publication|`, `role|`, `role_setting|`, `rows|`, `rows_md5|` and `schema|`.
- `grep -c no-select-privilege fp-prod-1.txt` should be `0`. Note any table that isn't.
- The `role||postgres|` line shows `bypassrls=true`, which makes the counts exact.

## D. Dump (about 5–15 min). Run back to back in a quiet period

Run each command, and check its exit code before running the next:
```bash
npx supabase db dump --db-url "$DUMP_URL" -f prod-roles.sql --role-only; echo "exit=$?"
```
```bash
npx supabase db dump --db-url "$DUMP_URL" -f prod-schema.sql; echo "exit=$?"
```
```bash
npx supabase db dump --db-url "$DUMP_URL" -f prod-data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"; echo "exit=$?"
```
```bash
npx supabase db dump --db-url "$DUMP_URL" -f prod-history-schema.sql --schema supabase_migrations; echo "exit=$?"
```
```bash
npx supabase db dump --db-url "$DUMP_URL" -f prod-history-data.sql --use-copy --data-only --schema supabase_migrations; echo "exit=$?"
```

Then check the files:
```bash
wc -c prod-*.sql; grep -c 'dump complete' prod-*.sql
```
- `prod-schema.sql` should hold the product tables. This should be about 35:
  ```bash
  grep -c 'CREATE TABLE IF NOT EXISTS "public"' prod-schema.sql
  ```
  And this should be greater than 0:
  ```bash
  grep -c '"channelwright"' prod-schema.sql
  ```
- Each file should contain `pg_dump`'s completion marker: `PostgreSQL database dump complete`, or `database cluster dump complete` for the roles file. If the count for any file is `0`, treat that file as truncated. The marker can be followed by `\unrestrict` and blank lines, so search for it rather than looking at the last line.

**If any command fails, or any file is empty or truncated** (a failed or incomplete dump):
1. Don't encrypt or keep any of the five files. A partial set isn't a backup, and it holds personal data.
2. Delete all five at once:
   ```bash
   rm -f prod-*.sql
   ```
   Then overwrite free space (`cipher /w:D:\secure` in PowerShell).
3. Note the error message in runbook §9, **without** any data lines. Fix the cause (connection, tool version, Docker), then start again from C.
4. After two failed attempts, **stop**: run `unset PGPASSWORD DBPW_ENC DUMP_URL DIRECT_URL`, close the terminal, and review with the owner.

Production is unaffected by a failed dump: it only reads.

## E. Second fingerprint, then compare

```bash
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=300s -c lock_timeout=2s' psql -X "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 -A -t -F '|' -f backup_fingerprint.sql > fp-prod-2.txt; echo "exit=$?"
```

The must-match categories are:
- `schema|`, `rows|` and `rows_md5|` lines for product schemas and `supabase_migrations`;
- `rows|` for `auth.users`, `auth.identities`, `storage.buckets` and `storage.objects`.

Managed-schema `schema|` lines are **not** must-match. Normal traffic changes them: token refreshes advance `auth` sequences, and Realtime maintains its partitions. The dump doesn't include their structure anyway.

List production's product schemas: the non-managed ones in the `schema|` lines. Put every one of them in `PRODUCT` (the example lists the ones known on 2026-11-08):
```bash
PRODUCT='public|channelwright|prospra_private|supabase_migrations'
```
```bash
MUST="^(schema|rows|rows_md5)\\|($PRODUCT)\\||^rows\\|(auth\\|(users|identities)|storage\\|(buckets|objects))\\|"
```
```bash
diff --strip-trailing-cr <(grep -E "$MUST" fp-prod-1.txt) <(grep -E "$MUST" fp-prod-2.txt) && echo "MUST-MATCH CATEGORIES UNCHANGED DURING DUMP"
```
- **Must print the line above.**
- A `rows|` or `rows_md5|` difference in a product table, or a changed `auth`/`storage` count, means data changed while the dumps ran. Delete the dumps as in D, then repeat C–E in a quieter moment.
- A product-schema `schema|` difference: **STOP**, because a product's schema changed during the backup.

Record the other differences and accept them (session, token, audit-log and realtime row counts change with normal sign-ins):
```bash
diff --strip-trailing-cr <(grep -v '^meta|' fp-prod-1.txt) <(grep -v '^meta|' fp-prod-2.txt) | grep '^[<>]' | cut -d'|' -f1-3 | sort -u
```

## F. Encrypt, delete the plaintext, then restore from the archive

Restoring from the decrypted archive proves that the stored archive itself is restorable.

**1. Record checksums, then encrypt.**
```bash
sha256sum prod-*.sql fp-prod-*.txt > SHA256SUMS
```
Encrypt with AES-256 and encrypted file names. 7-Zip prompts for a passphrase; store it in your password manager, never next to the archive. If the prompt echoes the passphrase or hangs in Git Bash, use PowerShell instead, in the same folder: `& "C:\Program Files-Zipz.exe" a -t7z -mhe=on -mx=9 -p "ent-prod-backup-$(Get-Date -Format yyyyMMdd).7z" prod-*.sql SHA256SUMS`, then `& "C:\Program Files-Zipz.exe" t (Get-ChildItem ent-prod-backup-*.7z)`.
```bash
"/c/Program Files/7-Zip/7z.exe" a -t7z -mhe=on -mx=9 -p ent-prod-backup-$(date +%Y%m%d).7z prod-*.sql SHA256SUMS
```
Test the archive:
```bash
"/c/Program Files/7-Zip/7z.exe" t ent-prod-backup-*.7z
```
`sha256sum` the archive and record it in runbook §9 (G-B.3).

**2. Delete the plaintext dumps at once.** Then overwrite free space (`cipher /w:D:\secure` in PowerShell). On an SSD, the BitLocker requirement in A.2 is what protects deleted plaintext.
```bash
rm -f prod-*.sql
```

**3. Remove the production credentials before restoring,** so nothing in the restore steps can reach production:
```bash
unset PGPASSWORD DBPW_ENC DIRECT_URL DUMP_URL
```

**4. Decrypt into a fresh restore folder, and start a disposable target.** Neither target uses production credentials.
```bash
mkdir restore && "/c/Program Files/7-Zip/7z.exe" x -orestore ent-prod-backup-*.7z
```
```bash
(cd restore && sha256sum -c SHA256SUMS --ignore-missing)
```
Every line must say `OK`.

- **T1, local Supabase stack (recommended).** It runs Auth and Storage migrations, so the `auth.*` and `storage.*` data has matching tables. The database is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, with local throwaway credentials.
  - First, `docker ps` must show **no other Supabase stack** running; any other local project would own port 54322. If one is running, stop it or **stop here**.
  - Run the commands one by one:
  ```bash
  mkdir restore-stack && cd restore-stack
  ```
  ```bash
  npx supabase init
  ```
  ```bash
  npx supabase start; echo "start exit=$?"; cd ..
  ```
  - **STOP unless `start exit=0`.**
  - Record its Postgres version: `psql -X "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -Atc "select version()"`.
  - Check with `docker ps` that every port is bound to `127.0.0.1`. If any show `0.0.0.0`, disconnect from shared networks or enable your firewall until teardown.
- **T2, bare Postgres image.** Same Postgres build as production. `--network none` means no network at all, and the password is random and throwaway.
  ```bash
  docker run -d --name ent-restore-check --network none -e POSTGRES_PASSWORD=$(openssl rand -hex 16) supabase/postgres:17.6.1.084
  ```
  - Its built-in `auth` schema is older than production's, so `auth.*` COPY lines can fail on missing columns.
  - Use `docker cp` plus `docker exec … psql -U postgres` for the commands below.

`RESTORE_URL` below is the T1 URL. For T2, run the same SQL through `docker exec`.
```bash
RESTORE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

Confirm the target has no tables in any product schema, so the restore can only land in a fresh database. **The `in (...)` list below must contain every schema in `PRODUCT` from E**, except `supabase_migrations`. If you added a schema to `PRODUCT`, add it here too. The result must be `0`:
```bash
psql -X "$RESTORE_URL" -Atc "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind in ('r','p') and n.nspname in ('public','channelwright','prospra_private')"
```
**STOP** if it isn't `0`. The target isn't fresh.

**5. Revoke the target's default privileges before restoring.** This is a documented Supabase step: otherwise restored tables inherit ALL privileges from the target's default privileges.
- Without it, a local test restored a view with `anon` access that the source had revoked, and the fingerprint flagged it.
- With it, the restore matched exactly.
```bash
psql -X "$RESTORE_URL" -v ON_ERROR_STOP=1 -c "alter default privileges in schema public revoke all on tables from anon, authenticated, service_role" -c "alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role" -c "alter default privileges in schema public revoke all on functions from anon, authenticated, service_role, public"
```

**6. Restore** in Supabase's documented order: all five files in one transaction, with triggers off for the data.
```bash
psql -X "$RESTORE_URL" --single-transaction -v ON_ERROR_STOP=1 -f restore/prod-roles.sql -f restore/prod-schema.sql -f restore/prod-history-schema.sql -c 'SET session_replication_role = replica' -f restore/prod-history-data.sql -f restore/prod-data.sql > restore.log 2>&1; echo "restore exit=$?"; grep -c ERROR restore.log
```
- **Must print `restore exit=0` and `0`.**
- **`restore.log` can contain row contents** (a failed `COPY` prints the row). Read it on screen only. Record only the exit code and the ERROR count in runbook §9, and delete the log in H.
- On an error, apply only the fixes Supabase documents for these cases, then restart from F.4 on a fresh target (`npx supabase stop --no-backup`, then `npx supabase start`) and record every edit:
  - comment out `ALTER … OWNER TO "supabase_admin"` lines;
  - comment out the `GRANT "postgres" TO "cli_login_postgres"` line;
  - comment out `COPY` blocks for platform-only tables such as `auth.oauth_clients`, together with their `\.` terminator.
- Never edit rows in a product schema.

## G. Verify the restored copy (G-B.5). This decides whether the backup is complete

```bash
PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=300s' psql -X "$RESTORE_URL" --single-transaction -v ON_ERROR_STOP=1 -A -t -F '|' -f backup_fingerprint.sql > fp-restored.txt; echo "exit=$?"
```

**1. Product schemas and the migration history: must be identical.** Use the same `PRODUCT` list as in E. This compares structure, grants, owners, sequence positions, exact row counts and content hashes.
```bash
diff --strip-trailing-cr <(grep -E "^(schema|rows|rows_md5)\\|($PRODUCT)\\|" fp-prod-2.txt) <(grep -E "^(schema|rows|rows_md5)\\|($PRODUCT)\\|" fp-restored.txt) && echo "PRODUCT SCHEMAS IDENTICAL"
```

**2. User data in managed schemas: row counts must match.**
```bash
for t in 'auth|users' 'auth|identities' 'storage|buckets' 'storage|objects'; do diff --strip-trailing-cr <(grep "^rows|$t|" fp-prod-2.txt) <(grep "^rows|$t|" fp-restored.txt) >/dev/null && echo "ok $t" || echo "DIFF $t"; done
```

**3. Product custom roles must be present with the same attributes.**
```bash
diff --strip-trailing-cr <(grep '^role|' fp-prod-2.txt) <(grep '^role|' fp-restored.txt)
```
Every line here must be a Supabase-reserved or platform role. **A difference in any product custom role is a STOP**; it can't be explained away.

**4. Everything else, listed for the record.** Each line must be explained in runbook §9.
```bash
diff --strip-trailing-cr <(grep -v '^meta|' fp-prod-2.txt) <(grep -v '^meta|' fp-restored.txt) | grep '^[<>]' | cut -d'|' -f1-3 | sort -u > fp-diff-other.txt; wc -l fp-diff-other.txt
```
Expected sources, from a local test:
- `role_setting` lines: reserved-role and database-level settings aren't in the dump. Compare them with the step B inventory.
- `default_acl` lines: changed deliberately in F.5.
- Managed-schema structure, platform roles and extensions of the target.
- Event triggers. Supabase's own event triggers differ by version. A **custom** event trigger missing from the restore is expected (see "Not covered") and must be listed in the step B inventory.
- Sequences inside managed schemas, such as `graphql`.

**Passes when:**
- step 1 prints `PRODUCT SCHEMAS IDENTICAL`;
- step 2 prints `ok` for every table;
- step 3 shows no product-role difference;
- every line from step 4 has a written explanation.

**STOP** otherwise. The backup isn't proven complete, and 002 must not be applied.

**Passing G proves that the backup restores into a disposable local database. It doesn't prove that the hosted project could be recovered in place** (runbook §7 R4).

## H. Tear down and record

1. Stop the disposable target. **T1:**
   ```bash
   cd restore-stack && npx supabase stop --no-backup && cd ..
   ```
   **T2:**
   ```bash
   docker rm -f ent-restore-check
   ```
2. Delete the decrypted copy and the restore log:
   ```bash
   rm -rf restore restore-stack restore.log
   ```
   Then overwrite free space.
3. Close the terminal.
4. Keep: the `.7z` archive (copy it to the second location), `SHA256SUMS`, the three fingerprint files, and `fp-diff-other.txt`.
   - The fingerprints hold catalog facts, md5 hashes and row counts only.
   - Setting values outside the allowlist are hashed.
5. Fill in runbook §9, G-B.1–G-B.7, with results and counts only. Put the retention end date in your calendar.
6. At the retention date, destroy both archive copies and any remaining decrypted copies, containers or volumes, and record it in §9.

## What the fingerprint detects, and what it doesn't

**Detects:**
- Any change in a product schema's:
  - tables, columns (type, nullability, identity, generated, default), table and domain constraints;
  - per-table RLS enabled and forced flags, table options (`reloptions`);
  - indexes, views (definitions and options such as `security_invoker`), sequences and types (including enum labels and type grants);
  - functions (full definitions, including SECURITY DEFINER and `search_path`), triggers on tables and views (including enabled state), rules and RLS policies.
- Schema, table, column, sequence, view and function grants; object owners; default privileges.
- Sequence positions, exact row counts, and **row contents**: an md5 over every row's text, so a changed value is caught even when the count matches.
- In every schema: roles and their attributes and memberships, extensions, publications, event triggers and large objects.
- In managed schemas: row counts only, no content hashes.

**Doesn't detect, or detects only partly:**
- **Content in managed schemas** (`auth`, `storage` and so on). They get row counts only, because those tables change during normal use. A restored `auth.users` with the right count but a wrong value wouldn't be caught.
- **Product tables over 50 MB** get a row count but no content hash (`rows_md5` says `skipped`). None exist today (database total: 22 MB). Because of bloat, a table near the limit could be skipped on one side and hashed on the other; treat that as a difference to explain.
- **Hashes say *that* something differs, not *what*.** A difference needs follow-up on the restored copy.
- **Hashes can differ when the meaning doesn't.** Definition text can change across Postgres or Supabase versions; T1's version can differ from production's.
- **Things outside the database** (see "What the five-file dump covers"): Storage files, Edge Functions, platform configuration, secrets, role passwords.
- **Setting values outside the allowlist** are compared by hash only.
- **Grants that reach a role only through role membership** aren't expanded. The direct grants are compared.
- **Not fingerprinted:**
  - indexes on materialized views (only table indexes are hashed);
  - sequence parameters (increment, minimum, maximum, cycle); only the position is compared;
  - the grantor and admin option of role memberships;
  - column-level statistics targets, comments and security labels;
  - foreign tables' remote data;
  - per-database settings other than the listed role and database settings.
- **Counts and content hashes are exact only when the connecting role bypasses RLS.** Production's `postgres` does (preflight row 11).
- md5 collisions are theoretically possible. They're not a practical concern for comparing a database with its own restore.

**Read-only guarantee:**
- **The query** is one read-only transaction (with `--single-transaction`; a write appended to the file was refused locally).
- **What it runs:** catalog and formatting functions, plus `query_to_xml`. That executes only `select count(*)` and an `md5(string_agg(row::text))` over ordinary and partitioned tables, never views or foreign tables.
- **One narrow caveat:** converting a row to text calls each column type's output function. That's an issue only for an exotic custom type with side effects, and the read-only transaction still blocks any write.

**Tested locally on 2026-11-08** (synthetic data, `supabase/postgres:17.6.1.084`):
- It ran as `postgres` with `bypassrls=true` and no privilege gaps: 255 lines in about 0.4 s.
- The output was identical under different `TimeZone`, `DateStyle`, `search_path` and float settings.
- Every text sort uses the "C" collation. That makes hashes independent of the database's collation; it holds by construction, and wasn't tested against a database with a different collation.
- A database-level `app.settings.jwt_secret` and a non-allowlisted role setting showed only as md5.
- A write appended to the file was refused.
- With the F.5 revoke, a restore matched on every must-match line.
- These were all detected:
  - a restore without F.5 (the `anon` re-grant);
  - one changed value at the same row count;
  - a moved sequence;
  - a lost schema `USAGE` grant, a lost column grant, a changed enum label and a lost role setting;
  - missing objects and missing data (earlier versions of this test).

**Not tested here:** the `supabase db dump` and `supabase start` commands. The Supabase CLI couldn't be run on this machine, so the first G-B run is that test, and G is what decides whether it passed.
