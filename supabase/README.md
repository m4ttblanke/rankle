# Supabase — Rankle

Migrations are the source of truth for the database. Do not make schema changes
in the dashboard.

## Migration set (apply 1→4 in order, as a set)

| File | Creates |
|---|---|
| `20260909003800_core_schema.sql` | `private` schema + `app_tz()`/`today()` helpers, `profiles` (+ `handle_new_user` trigger on `auth.users`), `tierlists`, `tierlist_items`, `is_admin()`, `is_tierlist_public()`, `tier_weight()`, `tg_set_updated_at()` |
| `20260909003851_submissions_results.sql` | `submissions`, `submission_items` (+ UPDATE-block immutability triggers), `tierlist_item_stats`, `has_submitted()`, `submit_ranking()` RPC, `get_results()` RPC |
| `20260909003915_sharing.sql` | `shares`, `create_share()` RPC, `get_share()` RPC |
| `20260909003945_rls_security_hardening.sql` | `enable row level security` on all 7 tables, revoke Supabase's default blanket table grants and re-grant the minimum, all RLS policies, `revoke execute` on the pre-existing `public.rls_auto_enable()` |

`seed.sql` is **local only** (`supabase db reset`); it is not applied to the
remote project by `supabase db push`.

## Apply

```bash
supabase link --project-ref zhivsldkpavidxzrgtjl
supabase db push          # applies pending migrations to the linked project
supabase db lint          # advisory checks
```

Locally (needs Docker):

```bash
supabase start
supabase db reset         # applies all migrations + seed.sql
```

## Canonical timezone

`America/Los_Angeles`, defined once in `private.app_tz()`. Not a Supabase
setting. Change it only there.

## Admin bootstrap

There is no self-service admin path. Grant admin to a known user id from a
privileged SQL session:

```sql
update public.profiles set is_admin = true where id = '<uuid>';
```

`is_admin` has no client column-update grant, so it cannot be set via the API.

## Applied

All four migrations were applied to `zhivsldkpavidxzrgtjl` on 2026-09-09 and
recorded in `supabase_migrations.schema_migrations` as `20260909003800`
`core_schema`, `20260909003851` `submissions_results`, `20260909003915`
`sharing`, `20260909003945` `rls_security_hardening`. The migration filenames in
this directory match those recorded versions, so local and remote history agree.
Post-apply verification: structure, privileges, and a 30-assertion behavioural
suite against the live schema all pass; advisors show only intentional-by-design
notices (see below). No seed data; no admin bootstrapped yet.

## Validation status (pre-apply)

- SQL syntax: verified offline against the real PostgreSQL grammar (libpg_query).
- Environment assumptions: verified read-only against the live project
  (`gen_random_uuid` in `pg_catalog`, `gen_random_bytes` in `extensions`,
  `anon`/`authenticated`/`service_role` present, `postgres` holds `TRIGGER` on
  `auth.users`, `ensure_rls` event trigger present, `public` schema clean,
  Supabase default ACL grants ALL on new `public` tables to `anon`/`authenticated`
  — hence the explicit revokes in migration 4).
- Behavioural / RLS tests: run against the linked remote as a
  `begin; <all four migrations> <supabase/tests/rls_spec.sql body>; rollback;`
  transactional dry-run (nothing persisted; catalog checked clean afterward).
  **74/74 assertions pass.** Covers: PL/pgSQL compilation, RLS policy logic,
  private helper behaviour, the spoiler gate (future games + community
  aggregates + friend/other rankings + share contents), admin authorization
  (allow and deny), submission immutability, ranking-payload validation,
  transactional aggregate correctness, and share-link authorization.
- Finding fixed during validation: RLS policies reference the `private.*`
  SECURITY DEFINER helpers, and this Postgres enforces the invoking role's
  EXECUTE privilege on functions named in a policy expression. `anon` /
  `authenticated` are therefore granted `USAGE` on schema `private` and
  `EXECUTE` on `is_admin()` / `is_tierlist_public()` / `has_submitted()`
  (migrations 1-2). Safe: each is SECURITY DEFINER, self-scoped to the caller,
  returns only a boolean, and `private` is not exposed through PostgREST.
- To re-run locally (needs Docker): `supabase start && supabase db reset`, then
  `psql "$(supabase status -o json | jq -r .DB_URL)" -f supabase/tests/rls_spec.sql`.
