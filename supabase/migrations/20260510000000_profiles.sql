-- Profiles table — Plan 02 columns only.
-- Plan 03 adds: tagline, about, wants, height_cm, body_type, hair_color, eye_color,
-- has_piercings, has_tattoos, smoking, drinking, education, yearly_income_band,
-- net_worth_band, age_verified_at. Plan 04 adds tokens audit columns. Etc.

CREATE TYPE profile_role          AS ENUM ('benefactor', 'baby');
CREATE TYPE profile_gender        AS ENUM ('male', 'female', 'nonbinary', 'other');
CREATE TYPE profile_looking_for   AS ENUM ('male', 'female', 'any');
CREATE TYPE profile_status        AS ENUM ('pending_onboarding', 'active', 'suspended', 'deactivated');

CREATE TABLE public.profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                profile_role,                              -- NULL until onboarding step 1
  display_name        text,
  date_of_birth       date,
  gender              profile_gender,
  looking_for         profile_looking_for,
  city_display_name   text,
  city_lat            double precision,
  city_lng            double precision,
  status              profile_status NOT NULL DEFAULT 'pending_onboarding',
  token_balance       int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_active_at      timestamptz,
  CONSTRAINT profiles_dob_min_age
    CHECK (date_of_birth IS NULL OR date_of_birth <= (now()::date - interval '18 years'))
);

COMMENT ON TABLE public.profiles IS
  '1:1 with auth.users. Plan 02 columns only — see plan docs for additions in later plans.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
