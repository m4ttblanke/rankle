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
   '["S","A","B","C","D"]'::jsonb),
  ('pixar-movies', 'Pixar Movies',
   'Rank Pixar''s feature films.', 'scheduled', private.today() + 1,
   '["S","A","B","C","D"]'::jsonb),
  ('breakfast-foods', 'Breakfast Foods',
   'The most important ranking of the day.', 'draft', null,
   '["S","A","B","C","D"]'::jsonb);

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
