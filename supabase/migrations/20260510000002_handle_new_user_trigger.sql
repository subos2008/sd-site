-- When a new user signs up via Supabase Auth, create their profile row in
-- 'pending_onboarding' status. Runs SECURITY DEFINER because auth.users
-- inserts are performed by the auth schema's own service role.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, status)
  VALUES (NEW.id, 'pending_onboarding');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
