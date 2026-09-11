-- Rankle -- Milestone 5: add `submission_id` to get_results()
--
-- Additive only: one new top-level key on the existing get_results() JSON
-- payload. Signature, eligibility gate, and every existing key are unchanged.
--
-- Why: M5 sharing needs the caller's own submission id to call
-- public.create_share(p_submission_id, p_guest_id). The client cannot read
-- public.submissions directly (no grant to anon; authenticated-only, RLS
-- restricted to the row's own owner) and get_results() already is the one
-- place a caller learns anything about their own submission for this game.
-- Exposing "your own submission id, to you, only after you already passed
-- get_results()'s eligibility gate" is not a new disclosure -- it's the same
-- caller, the same row, behind the same spoiler gate. create_share() still
-- independently re-verifies ownership of whatever id it's given (migration
-- 20260909003915_sharing.sql), so this id is never an authorization
-- mechanism on its own -- see docs/SECURITY.md sec 8, sec 9.
create or replace function public.get_results(
  p_tierlist_id uuid,
  p_guest_id    uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_eligible boolean := false;
  v_result   jsonb;
begin
  if v_uid is not null then
    v_eligible := private.has_submitted(p_tierlist_id);
  elsif p_guest_id is not null then
    v_eligible := exists (
      select 1
      from public.submissions s
      where s.tierlist_id = p_tierlist_id
        and s.guest_id = p_guest_id
    );
  end if;

  if not v_eligible then
    raise exception 'rankle: submit your ranking before viewing results'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'tierlist', (
      select jsonb_build_object(
        'id', t.id,
        'slug', t.slug,
        'title', t.title,
        'prompt', t.prompt,
        'tier_config', t.tier_config
      )
      from public.tierlists t
      where t.id = p_tierlist_id
    ),
    'total_submissions', (
      select count(*)
      from public.submissions s
      where s.tierlist_id = p_tierlist_id
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'item_id', ti.id,
            'label', ti.label,
            'image_url', ti.image_url,
            'sort_order', ti.sort_order,
            'tier_counts', coalesce(st.tier_counts, '{}'::jsonb),
            'n', coalesce(st.total_submissions, 0),
            'sum_weight', coalesce(st.sum_weight, 0),
            'avg_weight', case
              when coalesce(st.total_submissions, 0) > 0
              then round(st.sum_weight::numeric / st.total_submissions, 3)
              else null
            end
          )
          order by ti.sort_order
        ),
        '[]'::jsonb
      )
      from public.tierlist_items ti
      left join public.tierlist_item_stats st on st.tierlist_item_id = ti.id
      where ti.tierlist_id = p_tierlist_id
    ),
    'my_ranking', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'item_id', si.tierlist_item_id,
            'tier', si.tier,
            'position', si.position
          )
          order by si.tier, si.position
        ),
        '[]'::jsonb
      )
      from public.submission_items si
      join public.submissions s on s.id = si.submission_id
      where s.tierlist_id = p_tierlist_id
        and (
          (v_uid is not null and s.user_id = v_uid)
          or (v_uid is null and s.guest_id = p_guest_id)
        )
    ),
    -- New in Milestone 5: the caller's own submission id (see header comment).
    'submission_id', (
      select s.id
      from public.submissions s
      where s.tierlist_id = p_tierlist_id
        and (
          (v_uid is not null and s.user_id = v_uid)
          or (v_uid is null and s.guest_id = p_guest_id)
        )
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_results(uuid, uuid) from public;
grant execute on function public.get_results(uuid, uuid) to anon, authenticated;
