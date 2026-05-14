-- Plan 03 interests taxonomy seed. Idempotent via UNIQUE(label_key).

INSERT INTO public.interests (label_key, category, ordinal, active) VALUES
  -- Lifestyle (cat 'lifestyle')
  ('interest.fitness',      'lifestyle', 10, true),
  ('interest.cooking',      'lifestyle', 20, true),
  ('interest.fashion',      'lifestyle', 30, true),
  ('interest.wine',         'lifestyle', 40, true),
  ('interest.fine_dining',  'lifestyle', 50, true),
  ('interest.yoga',         'lifestyle', 60, true),
  -- Activities (cat 'activities')
  ('interest.hiking',       'activities', 10, true),
  ('interest.skiing',       'activities', 20, true),
  ('interest.tennis',       'activities', 30, true),
  ('interest.golf',         'activities', 40, true),
  ('interest.swimming',     'activities', 50, true),
  ('interest.dancing',      'activities', 60, true),
  -- Going out (cat 'going_out')
  ('interest.theatre',      'going_out', 10, true),
  ('interest.cinema',       'going_out', 20, true),
  ('interest.concerts',     'going_out', 30, true),
  ('interest.museums',      'going_out', 40, true),
  ('interest.nightlife',    'going_out', 50, true),
  ('interest.galleries',    'going_out', 60, true),
  -- Travel (cat 'travel')
  ('interest.weekend_trips','travel', 10, true),
  ('interest.beach',        'travel', 20, true),
  ('interest.city_breaks',  'travel', 30, true),
  ('interest.adventure',    'travel', 40, true),
  ('interest.cruises',      'travel', 50, true),
  ('interest.luxury_travel','travel', 60, true),
  -- Other (cat 'other')
  ('interest.reading',      'other', 10, true),
  ('interest.gaming',       'other', 20, true),
  ('interest.photography',  'other', 30, true),
  ('interest.languages',    'other', 40, true),
  ('interest.pets',         'other', 50, true),
  ('interest.volunteering', 'other', 60, true)
ON CONFLICT (label_key) DO UPDATE SET
  category = EXCLUDED.category,
  ordinal  = EXCLUDED.ordinal,
  active   = EXCLUDED.active;
