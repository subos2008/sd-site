-- Plan 03: extend profiles with bio + physical + lifestyle columns + enums.
-- Spec §3 (Identity).

CREATE TYPE body_type        AS ENUM ('slim', 'athletic', 'average', 'curvy', 'plus_size', 'muscular');
CREATE TYPE hair_color       AS ENUM ('black', 'brown', 'blonde', 'red', 'grey', 'other');
CREATE TYPE eye_color        AS ENUM ('brown', 'blue', 'green', 'hazel', 'grey', 'other');
CREATE TYPE smoking_habit    AS ENUM ('never', 'occasionally', 'regularly', 'prefer_not_to_say');
CREATE TYPE drinking_habit   AS ENUM ('never', 'socially', 'regularly', 'prefer_not_to_say');
CREATE TYPE education_level  AS ENUM ('high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'other');
CREATE TYPE income_band      AS ENUM ('under_50k', '50_100k', '100_250k', '250_500k', '500k_1m', 'over_1m', 'prefer_not_to_say');
CREATE TYPE net_worth_band   AS ENUM ('under_250k', '250k_1m', '1m_5m', '5m_25m', 'over_25m', 'prefer_not_to_say');

ALTER TABLE public.profiles
  ADD COLUMN tagline            text,
  ADD COLUMN about              text,
  ADD COLUMN wants              text,
  ADD COLUMN height_cm          int,
  ADD COLUMN body_type          body_type,
  ADD COLUMN hair_color         hair_color,
  ADD COLUMN eye_color          eye_color,
  ADD COLUMN has_piercings      boolean,
  ADD COLUMN has_tattoos        boolean,
  ADD COLUMN smoking            smoking_habit,
  ADD COLUMN drinking           drinking_habit,
  ADD COLUMN education          education_level,
  ADD COLUMN yearly_income_band income_band,
  ADD COLUMN net_worth_band     net_worth_band;

-- Bounds checks. Tagline is the visible title; about/wants are free-form.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tagline_len  CHECK (tagline IS NULL OR (length(tagline) BETWEEN 1 AND 120)),
  ADD CONSTRAINT profiles_about_len    CHECK (about   IS NULL OR length(about) <= 4000),
  ADD CONSTRAINT profiles_wants_len    CHECK (wants   IS NULL OR length(wants) <= 2000),
  ADD CONSTRAINT profiles_height_range CHECK (height_cm IS NULL OR (height_cm BETWEEN 120 AND 240));

COMMENT ON COLUMN public.profiles.tagline IS 'Visible profile title (1-120 chars).';
COMMENT ON COLUMN public.profiles.about   IS 'Free-form "About me" text (<=4000 chars).';
COMMENT ON COLUMN public.profiles.wants   IS 'Free-form "What I want" text (<=2000 chars).';
