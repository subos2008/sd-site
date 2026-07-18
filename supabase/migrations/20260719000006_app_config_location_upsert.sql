-- The 'location' app_config key was added by regenerating the original
-- app_config seed migration (20260509000001), which environments provisioned
-- before plan 015 will never re-apply. Re-assert it idempotently so
-- search_places (which fails closed without it) works after a plain
-- `supabase db push`. Value must stay in sync with shared/app-config.ts;
-- regenerate via `pnpm gen:config` if the shape changes.
INSERT INTO public.app_config(key, value) VALUES ('location', $cfg_location${"enabledCountries":["GB"]}$cfg_location$::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
