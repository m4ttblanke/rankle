-- Rankle MVP -- Migration 3/4: sharing
--
-- Depends on migrations 1-2.
--
-- Creates:
--   * shares             (one spoiler-safe share record per submission)
--   * public.create_share (SECURITY DEFINER RPC: mint/return a token; owner only)
--   * public.get_share    (SECURITY DEFINER RPC: teaser always; ranking only if
--                          the viewer is the sender or is themselves eligible)
--
-- shares has no RLS policies and no table grants (migration 4). All access is
-- through these two RPCs, so the spoiler gate and share eligibility are always
-- evaluated server-side.

------------------------------------------------------------------------
-- 1. shares
------------------------------------------------------------------------
create table public.shares (
  id            uuid primary key default gen_random_uuid(),
  token         text not null,
  tierlist_id   uuid not null references public.tierlists (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  guest_id      uuid,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint shares_token_len check (char_length(token) between 16 and 64)
);

create unique index shares_token_key on public.shares (token);
create unique index shares_submission_key on public.shares (submission_id);
create index shares_tierlist_id_idx on public.shares (tierlist_id);
create index shares_created_by_idx
  on public.shares (created_by)
  where created_by is not null;

------------------------------------------------------------------------
-- 2. create_share
------------------------------------------------------------------------
create or replace function public.create_share(
  p_submission_id uuid,
  p_guest_id      uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_sub   public.submissions%rowtype;
  v_token text;
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'rankle: submission not found' using errcode = 'no_data_found';
  end if;

  -- ownership: the authenticated author, or the guest who owns this submission
  if not (
    (v_uid is not null and v_sub.user_id = v_uid)
    or (v_uid is null and p_guest_id is not null and v_sub.guest_id = p_guest_id)
  ) then
    raise exception 'rankle: you can only share your own ranking'
      using errcode = 'insufficient_privilege';
  end if;

  -- idempotent: one share per submission
  select token into v_token from public.shares where submission_id = p_submission_id;
  if v_token is not null then
    return v_token;
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.shares (token, tierlist_id, submission_id, created_by, guest_id)
  values (v_token, v_sub.tierlist_id, p_submission_id, v_sub.user_id, v_sub.guest_id)
  on conflict (submission_id) do nothing;

  -- re-read in case a concurrent call inserted first
  select token into v_token from public.shares where submission_id = p_submission_id;
  return v_token;
end;
$$;

revoke all on function public.create_share(uuid, uuid) from public;
grant execute on function public.create_share(uuid, uuid) to anon, authenticated;

------------------------------------------------------------------------
-- 3. get_share
------------------------------------------------------------------------
create or replace function public.get_share(
  p_token    text,
  p_guest_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_share    public.shares%rowtype;
  v_teaser   jsonb;
  v_eligible boolean := false;
begin
  select * into v_share from public.shares where token = p_token;
  if not found or v_share.revoked then
    return jsonb_build_object('found', false);
  end if;

  -- spoiler-safe teaser: always returned (safe for OpenGraph / link previews)
  v_teaser := jsonb_build_object(
    'found', true,
    'sender', (
      select jsonb_build_object(
        'username', p.username,
        'display_name', p.display_name
      )
      from public.profiles p
      where p.id = v_share.created_by
    ),
    'tierlist', (
      select jsonb_build_object(
        'slug', t.slug,
        'title', t.title,
        'prompt', t.prompt
      )
      from public.tierlists t
      where t.id = v_share.tierlist_id
    )
  );

  -- eligibility to see the actual ranking:
  --   (a) the sender viewing their own share, or
  --   (b) a viewer who has their own official submission for this game
  if v_uid is not null then
    v_eligible := (v_share.created_by = v_uid)
                  or private.has_submitted(v_share.tierlist_id);
  elsif p_guest_id is not null then
    v_eligible := (v_share.guest_id = p_guest_id)
                  or exists (
                    select 1
                    from public.submissions s
                    where s.tierlist_id = v_share.tierlist_id
                      and s.guest_id = p_guest_id
                  );
  end if;

  if not v_eligible then
    return v_teaser || jsonb_build_object('locked', true, 'ranking', null);
  end if;

  return v_teaser || jsonb_build_object(
    'locked', false,
    'ranking', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'item_id', ti.id,
            'label', ti.label,
            'image_url', ti.image_url,
            'tier', si.tier,
            'position', si.position
          )
          order by si.tier, si.position
        ),
        '[]'::jsonb
      )
      from public.submission_items si
      join public.tierlist_items ti on ti.id = si.tierlist_item_id
      where si.submission_id = v_share.submission_id
    )
  );
end;
$$;

revoke all on function public.get_share(text, uuid) from public;
grant execute on function public.get_share(text, uuid) to anon, authenticated;
