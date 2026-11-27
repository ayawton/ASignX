ALTER TABLE public.user_achievements RENAME TO profile_achievements;
ALTER TABLE public.profile_achievements RENAME CONSTRAINT user_achievements_pkey TO profile_achievements_pkey;
ALTER TABLE public.profile_achievements RENAME CONSTRAINT user_achievements_user_id_profiles_id_fkey TO profile_achievements_user_id_profiles_id_fkey;
ALTER TABLE public.profile_achievements RENAME CONSTRAINT user_achievements_achievement_id_achievements_id_fkey TO profile_achievements_achievement_id_achievements_id_fkey;
ALTER INDEX public.user_achievements_achievement_idx RENAME TO profile_achievements_achievement_idx;
ALTER POLICY user_achievements_read_own ON public.profile_achievements RENAME TO profile_achievements_read_own;
ALTER TRIGGER user_achievements_immutable ON public.profile_achievements RENAME TO profile_achievements_immutable;
ALTER TRIGGER user_achievements_validate ON public.profile_achievements RENAME TO profile_achievements_validate;

ALTER TABLE public.achievements
    ADD COLUMN status varchar(10) NOT NULL DEFAULT 'published',
    ADD COLUMN icon varchar(10) NOT NULL DEFAULT 'trophy',
    ADD CONSTRAINT achievements_status_valid CHECK (status IN ('draft', 'published', 'retired')),
    ADD CONSTRAINT achievements_icon_valid CHECK (icon IN ('lesson', 'practice', 'xp', 'streak', 'trophy'));
ALTER POLICY achievements_read ON public.achievements USING (status = 'published');

CREATE FUNCTION asignx_private.achievement_metrics(learner uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
    SELECT jsonb_build_object(
        'completed_lessons', (SELECT count(*) FROM public.lesson_progress p JOIN public.enrollments e ON e.id=p.enrollment_id WHERE e.user_id=learner AND p.completed_at IS NOT NULL),
        'successful_practices', (SELECT count(*) FROM public.practice_rounds r WHERE r.user_id=learner AND r.completed_at IS NOT NULL AND asignx_private.practice_round_succeeded(r.id)),
        'total_xp', (SELECT coalesce(sum(a.amount),0) FROM public.xp_awards a JOIN public.enrollments e ON e.id=a.enrollment_id WHERE e.user_id=learner),
        'streak_days', asignx_private.current_streak(learner)
    )
$$;

CREATE OR REPLACE FUNCTION asignx_private.validate_achievement() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE badge public.achievements%ROWTYPE;
BEGIN
    SELECT * INTO badge FROM public.achievements WHERE id=NEW.achievement_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown achievement' USING ERRCODE='23503'; END IF;
    IF badge.status <> 'published' OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.user_id AND role='learner') OR
       (asignx_private.achievement_metrics(NEW.user_id)->>badge.metric)::bigint < badge.threshold THEN
        RAISE EXCEPTION 'Achievement threshold has not been met or badge is unavailable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION asignx_private.guard_achievement_definition() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF (NEW.metric, NEW.threshold) IS DISTINCT FROM (OLD.metric, OLD.threshold)
       AND EXISTS (SELECT 1 FROM public.profile_achievements WHERE achievement_id=OLD.id) THEN
        RAISE EXCEPTION 'Awarded achievement definitions are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;

CREATE FUNCTION asignx_private.award_achievements(learner uuid) RETURNS void
LANGUAGE sql SET search_path = '' AS $$
    INSERT INTO public.profile_achievements(user_id, achievement_id)
    SELECT learner, a.id FROM public.achievements a
    CROSS JOIN (SELECT asignx_private.achievement_metrics(learner) AS metrics) m
    WHERE a.status='published' AND (m.metrics->>a.metric)::bigint >= a.threshold
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id=learner AND role='learner')
      AND NOT EXISTS (SELECT 1 FROM public.profile_achievements p WHERE p.user_id=learner AND p.achievement_id=a.id)
    ORDER BY a.id
    ON CONFLICT DO NOTHING
$$;

CREATE FUNCTION asignx_private.award_for_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE learner uuid;
BEGIN
    PERFORM pg_advisory_xact_lock_shared(742116, 1);
    IF TG_TABLE_NAME='practice_rounds' THEN learner := NEW.user_id;
    ELSE SELECT user_id INTO learner FROM public.enrollments WHERE id=NEW.enrollment_id;
    END IF;
    PERFORM asignx_private.award_achievements(learner);
    RETURN NEW;
END $$;
CREATE TRIGGER achievements_on_lesson AFTER INSERT OR UPDATE OF completed_at ON public.lesson_progress
    FOR EACH ROW WHEN (NEW.completed_at IS NOT NULL) EXECUTE FUNCTION asignx_private.award_for_activity();
CREATE TRIGGER achievements_on_xp AFTER INSERT ON public.xp_awards
    FOR EACH ROW WHEN (NEW.amount > 0) EXECUTE FUNCTION asignx_private.award_for_activity();
CREATE TRIGGER achievements_on_practice AFTER UPDATE OF completed_at ON public.practice_rounds
    FOR EACH ROW WHEN (OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL) EXECUTE FUNCTION asignx_private.award_for_activity();

CREATE FUNCTION asignx_private.award_published_achievement() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    INSERT INTO public.profile_achievements(user_id, achievement_id)
    SELECT p.id, NEW.id FROM public.profiles p WHERE p.role='learner'
      AND (asignx_private.achievement_metrics(p.id)->>NEW.metric)::bigint >= NEW.threshold
      AND NOT EXISTS (SELECT 1 FROM public.profile_achievements a WHERE a.user_id=p.id AND a.achievement_id=NEW.id)
    ORDER BY p.id
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END $$;
CREATE TRIGGER achievements_publish AFTER INSERT OR UPDATE OF status, metric, threshold ON public.achievements
    FOR EACH ROW WHEN (NEW.status='published') EXECUTE FUNCTION asignx_private.award_published_achievement();

-- Ensure publication backfill and activity awards cannot miss each other's commits.
CREATE FUNCTION asignx_private.lock_achievement_catalog() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(742116, 1);
    RETURN NULL;
END $$;
CREATE TRIGGER achievements_catalog_lock BEFORE INSERT OR UPDATE ON public.achievements
    FOR EACH STATEMENT EXECUTE FUNCTION asignx_private.lock_achievement_catalog();

REVOKE ALL ON FUNCTION asignx_private.achievement_metrics(uuid), asignx_private.award_achievements(uuid),
    asignx_private.award_for_activity(), asignx_private.award_published_achievement(),
    asignx_private.lock_achievement_catalog() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION asignx_private.achievement_metrics(uuid), asignx_private.award_achievements(uuid),
    asignx_private.award_for_activity(), asignx_private.award_published_achievement() TO service_role;

INSERT INTO public.achievements(code, name, description, metric, threshold, status, icon) VALUES
    ('FIRST_LESSON', 'First Lesson', 'Complete your first lesson.', 'completed_lessons', 1, 'published', 'lesson'),
    ('PRACTICE_REGULAR', 'Practice Regular', 'Finish five successful Practice rounds.', 'successful_practices', 5, 'published', 'practice'),
    ('XP_MILESTONE', 'XP Milestone', 'Earn 100 XP.', 'total_xp', 100, 'published', 'xp'),
    ('THREE_DAY_STREAK', 'Three-Day Streak', 'Reach a three-day learning streak.', 'streak_days', 3, 'published', 'streak')
ON CONFLICT (code) DO NOTHING;
