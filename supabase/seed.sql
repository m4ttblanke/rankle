-- Rankle -- LOCAL / DEV SEED ONLY.
--
-- This file is run by `supabase db reset` against the LOCAL stack. It is NOT
-- applied to the remote project by `supabase db push`. Do not add production
-- content here. Application behavior must never depend on these specific rows
-- (MANUAL sec 33).

-- Three demo games: one live today, one scheduled for tomorrow, one draft.
insert into public.tierlists (slug, title, prompt, status, release_date, tier_config)
values
  ('fast-food-fries', 'Fast Food Fries',
   'Rank the fries. No fence-sitting.', 'live', private.today(),
   '["S","A","B","C","F","N/A"]'::jsonb),
  ('pixar-movies', 'Pixar Movies',
   'Rank Pixar''s feature films.', 'scheduled', private.today() + 1,
   '["S","A","B","C","F","N/A"]'::jsonb),
  ('breakfast-foods', 'Breakfast Foods',
   'The most important ranking of the day.', 'draft', null,
   '["S","A","B","C","F","N/A"]'::jsonb);

insert into public.tierlist_items (tierlist_id, label, sort_order)
select t.id, x.label, x.ord
from public.tierlists t
cross join (
  values
    ('McDonald''s', 0), ('Five Guys', 1), ('In-N-Out', 2), ('Wendy''s', 3),
    ('Burger King', 4), ('Chick-fil-A waffle fries', 5),
    ('Arby''s curly fries', 6), ('Shake Shack crinkle-cut', 7),
    ('Popeyes Cajun fries', 8), ('Culver''s', 9)
) as x(label, ord)
where t.slug = 'fast-food-fries';

insert into public.tierlist_items (tierlist_id, label, sort_order)
select t.id, x.label, x.ord
from public.tierlists t
cross join (
  values
    ('Toy Story', 0), ('The Incredibles', 1), ('Ratatouille', 2),
    ('WALL-E', 3), ('Up', 4), ('Inside Out', 5), ('Coco', 6),
    ('Monsters, Inc.', 7), ('Finding Nemo', 8), ('Cars', 9)
) as x(label, ord)
where t.slug = 'pixar-movies';

-- A fourth demo game, already archived (no longer "today's" game) with a
-- pre-seeded submission + share, so e2e tests can exercise Milestone 5's
-- "this Rankle has already wrapped up" old-link behavior without needing
-- admin tooling or the archive-gameplay feature (Milestone 9) this milestone
-- deliberately does not build. Inserted directly (bypassing submit_ranking),
-- since submissions are only ever accepted for a `live` game.
insert into public.tierlists (id, slug, title, prompt, status, release_date, tier_config)
values
  ('99999999-0000-0000-0000-000000000001', 'retro-snacks', 'Retro Snacks',
   'A blast from the past.', 'archived', private.today() - 1,
   '["S","A","B","C","F","N/A"]'::jsonb);

insert into public.tierlist_items (id, tierlist_id, label, sort_order)
values
  ('99999999-0000-0000-0000-0000000000a1', '99999999-0000-0000-0000-000000000001', 'Dunkaroos', 0),
  ('99999999-0000-0000-0000-0000000000a2', '99999999-0000-0000-0000-000000000001', 'Gushers', 1),
  ('99999999-0000-0000-0000-0000000000a3', '99999999-0000-0000-0000-000000000001', 'Fruit by the Foot', 2);

insert into public.submissions (id, tierlist_id, guest_id)
values
  ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-000000000001',
   '99999999-0000-0000-0000-0000000000c1');

insert into public.submission_items (submission_id, tierlist_item_id, tier, position)
values
  ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-0000000000a1', 'S', 0),
  ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-0000000000a2', 'A', 0),
  ('99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-0000000000a3', 'F', 0);

insert into public.shares (token, tierlist_id, submission_id, guest_id)
values
  ('deadbeefdeadbeefdeadbeefdeadbeef', '99999999-0000-0000-0000-000000000001',
   '99999999-0000-0000-0000-0000000000b1', '99999999-0000-0000-0000-0000000000c1');
