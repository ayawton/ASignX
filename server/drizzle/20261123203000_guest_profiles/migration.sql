CREATE OR REPLACE FUNCTION asignx_private.create_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.email_confirmed_at IS NULL AND NEW.is_anonymous IS NOT TRUE THEN RETURN NEW; END IF;
    INSERT INTO public.profiles(id, display_name)
    VALUES (NEW.id, CASE WHEN NEW.is_anonymous THEN 'Guest learner' ELSE
        left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
            nullif(btrim(NEW.raw_user_meta_data->>'name'), ''), 'ASL explorer'), 100) END)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION asignx_private.require_confirmed_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = NEW.id
        AND CASE WHEN u.is_anonymous THEN NEW.role = 'learner' ELSE u.email_confirmed_at IS NOT NULL END
    ) THEN
        RAISE EXCEPTION 'A verified account or anonymous learner is required for this profile' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER profiles_require_confirmed ON public.profiles;
CREATE TRIGGER profiles_require_confirmed BEFORE INSERT OR UPDATE OF id, role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION asignx_private.require_confirmed_profile();
--> statement-breakpoint
DROP TRIGGER asignx_auth_user_created ON auth.users;
CREATE TRIGGER asignx_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW WHEN (NEW.email_confirmed_at IS NOT NULL OR NEW.is_anonymous IS TRUE)
    EXECUTE FUNCTION asignx_private.create_profile();
--> statement-breakpoint
INSERT INTO public.profiles(id, display_name)
SELECT id, 'Guest learner' FROM auth.users WHERE is_anonymous IS TRUE
ON CONFLICT (id) DO NOTHING;
