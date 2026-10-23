-- Activation follows Supabase's verified email timestamp, never a browser redirect.
-- Keep migration history intact: replace only the signup/profile rules here.
CREATE OR REPLACE FUNCTION asignx_private.create_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
    INSERT INTO public.profiles(id, display_name)
    VALUES (NEW.id, left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
        nullif(btrim(NEW.raw_user_meta_data->>'name'), ''), 'ASL explorer'), 100))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER asignx_auth_user_created ON auth.users;
CREATE TRIGGER asignx_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW WHEN (NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION asignx_private.create_profile();
CREATE TRIGGER asignx_auth_user_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
    EXECUTE FUNCTION asignx_private.create_profile();
--> statement-breakpoint
-- Never cascade-delete saved learning activity while correcting old pending profiles.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
        WHERE u.email_confirmed_at IS NULL AND (
            EXISTS (SELECT 1 FROM public.enrollments e WHERE e.user_id = p.id) OR
            EXISTS (SELECT 1 FROM public.practice_attempts a WHERE a.user_id = p.id) OR
            EXISTS (SELECT 1 FROM public.recognition_sessions s WHERE s.user_id = p.id) OR
            EXISTS (SELECT 1 FROM public.user_achievements a WHERE a.user_id = p.id)
        )
    ) THEN
        RAISE EXCEPTION 'Unconfirmed profiles have saved activity. Reconcile these accounts before applying confirmed_profiles.';
    END IF;
END $$;
DELETE FROM public.profiles p USING auth.users u
    WHERE p.id = u.id AND u.email_confirmed_at IS NULL;
--> statement-breakpoint
-- Only verified identities are backfilled; confirmed existing profiles keep all details.
INSERT INTO public.profiles(id, display_name)
SELECT id, left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(raw_user_meta_data->>'name'), ''), 'ASL explorer'), 100)
FROM auth.users WHERE email_confirmed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
-- Also defend privileged/manual profile inserts, not just the normal signup path.
CREATE FUNCTION asignx_private.require_confirmed_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.id AND u.email_confirmed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Email must be confirmed before creating a learner profile' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER profiles_require_confirmed BEFORE INSERT OR UPDATE OF id ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION asignx_private.require_confirmed_profile();
REVOKE ALL ON FUNCTION asignx_private.create_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION asignx_private.require_confirmed_profile() FROM PUBLIC, anon, authenticated;
