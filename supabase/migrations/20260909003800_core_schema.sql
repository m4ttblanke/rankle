-- Rankle MVP -- Migration 1/4: core schema
--
-- Creates:
--   * private schema + canonical-timezone helpers
--   * updated_at touch trigger
--   * profiles                (public-facing player identity)
--   * handle_new_user trigger (auth.users -> profiles)
--   * tierlists               (the daily game)
--   * tierlist_items          (the rankable items)
--   * private helper functions that depend on the tables above
--
-- RLS is auto-enabled on new public tables by the project's `ensure_rls`
-- event trigger; explicit `enable row level security`, every policy, and all
-- privilege hardening live in migration 4. Apply migrations 1-4 as an ordered
-- set.

------------------------------------------------------------------------
-- 0. Private schema: internal helpers, never exposed through the API
------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
-- anon / authenticated need USAGE so that RLS policies can reference the
-- helper functions below. This Postgres enforces the invoking role's EXECUTE
-- privilege on functions named inside a policy expression, so the three
-- policy-helpers (is_admin, is_tierlist_public, has_submitted) are also
-- granted EXECUTE to those roles. That is safe: each is SECURITY DEFINER,
-- does its own auth.uid() check, and returns only a boolean about the caller
-- or about public release state. The `private` schema is not exposed through
-- PostgREST, so these never become API endpoints.
grant usage on schema private to anon, authenticated;

-- Canonical application timezone. Single source of truth: change it here only.
create or replace function private.app_tz()
returns text
language sql
immutable
set search_path = ''
as $$ select 'America/Los_Angeles'::text $$;
revoke all on function private.app_tz() from public, anon, authenticated;

-- "Today" in the canonical timezone. Used for release gating.
create or replace function private.today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone private.app_tz())::date $$;
revoke all on function private.today() from public, anon, authenticated;

------------------------------------------------------------------------
-- 1. updated_at touch trigger (local; avoids a moddatetime dependency)
------------------------------------------------------------------------
create or replace function private.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.tg_set_updated_at() from public, anon, authenticated;

------------------------------------------------------------------------
-- 2. profiles
------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null,
  display_name text not null,
  avatar_url   text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len
    check (char_length(display_name) between 1 and 50)
);

-- case-insensitive unique username
create unique index profiles_username_lower_key
  on public.profiles (lower(username));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.tg_set_updated_at();

comment on table public.profiles is
  'Player profile. Direct reads are authenticated-only (migration 4); anonymous visitors get sender info solely via get_share(). Signed-in users can read only id, username, display_name, avatar_url, created_at (column grants). is_admin is trusted server state, never client-writable. Private data (phone/email) is intentionally not stored here.';

------------------------------------------------------------------------
-- 3. auth.users -> profiles on signup
------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 12),
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
        'Player'
      ),
      50
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

------------------------------------------------------------------------
-- 4. tierlists (the daily game)
------------------------------------------------------------------------
create table public.tierlists (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null,
  title        text not null,
  prompt       text,
  release_date date,
  status       text not null default 'draft',
  tier_config  jsonb not null default '["S","A","B","C","D"]'::jsonb,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,
  constraint tierlists_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint tierlists_status_valid
    check (status in ('draft', 'scheduled', 'live', 'archived', 'disabled')),
  constraint tierlists_tier_config_shape
    check (
      jsonb_typeof(tier_config) = 'array'
      and jsonb_array_length(tier_config) between 2 and 8
    )
);

create unique index tierlists_slug_key on public.tierlists (slug);

-- one official game per release date (drafts / disabled do not reserve a date)
create unique index tierlists_release_date_key
  on public.tierlists (release_date)
  where release_date is not null
    and status in ('scheduled', 'live', 'archived');

-- resolver: "latest released game"
create index tierlists_status_release_idx
  on public.tierlists (status, release_date desc);

create index tierlists_created_by_idx
  on public.tierlists (created_by);

create trigger tierlists_set_updated_at
  before update on public.tierlists
  for each row execute function private.tg_set_updated_at();

------------------------------------------------------------------------
-- 5. tierlist_items
------------------------------------------------------------------------
create table public.tierlist_items (
  id          uuid primary key default gen_random_uuid(),
  tierlist_id uuid not null references public.tierlists (id) on delete cascade,
  label       text not null,
  image_url   text,
  sort_order  integer not null,
  created_at  timestamptz not null default now(),
  constraint tierlist_items_label_len check (char_length(label) between 1 and 120),
  constraint tierlist_items_sort_order_nonneg check (sort_order >= 0)
);

create unique index tierlist_items_order_key
  on public.tierlist_items (tierlist_id, sort_order);

create index tierlist_items_tierlist_id_idx
  on public.tierlist_items (tierlist_id);

------------------------------------------------------------------------
-- 6. internal helpers that depend on the tables created above
------------------------------------------------------------------------

-- Admin check. SECURITY DEFINER so it does not recurse into profiles RLS
-- when profiles' own policies (or other tables' policies) call it.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_admin
  );
$$;
-- Referenced by RLS policies -> the invoking role must be able to execute it.
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Is this tierlist released to the public yet? SECURITY DEFINER so it does not
-- recurse into tierlists RLS when used by that table's own SELECT policy.
create or replace function private.is_tierlist_public(p_tierlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tierlists t
    where t.id = p_tierlist_id
      and t.status in ('scheduled', 'live', 'archived')
      and t.release_date is not null
      and t.release_date <= private.today()
  );
$$;
-- Referenced by RLS policies -> the invoking role must be able to execute it.
revoke all on function private.is_tierlist_public(uuid) from public;
grant execute on function private.is_tierlist_public(uuid) to anon, authenticated;

-- Position-based tier weight: the first entry in tier_config is the highest.
-- ["S","A","B","C","D"] -> S=5, A=4, B=3, C=2, D=1. Unknown tier -> 0.
create or replace function private.tier_weight(p_tier_config jsonb, p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_array_length(p_tier_config)
      - (
          select ord - 1
          from jsonb_array_elements_text(p_tier_config) with ordinality as e(val, ord)
          where e.val = p_tier
          limit 1
        ),
    0
  );
$$;
revoke all on function private.tier_weight(jsonb, text) from public, anon, authenticated;
