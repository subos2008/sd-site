-- Ethnicity: captured on the single-page signup (SB's five values). Nullable,
-- like every other profile attribute. Threads where body_type threads.
CREATE TYPE ethnicity AS ENUM ('white', 'black', 'asian', 'hispanic', 'other');

ALTER TABLE public.profiles ADD COLUMN ethnicity ethnicity;

COMMENT ON COLUMN public.profiles.ethnicity IS 'Self-reported ethnicity (special-category data; only captured on completed signup).';
