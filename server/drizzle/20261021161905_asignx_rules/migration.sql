-- Custom SQL migration file, put your code below! --
-- Cross-table rules and grants are versioned SQL; Drizzle's schema handles DDL/RLS.
CREATE SCHEMA asignx_private;
REVOKE ALL ON SCHEMA asignx_private FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'profiles','signs','courses','lessons','lesson_signs','exercises','exercise_options',
        'enrollments','lesson_progress','exercise_attempts','model_versions','practice_attempts',
        'recognition_sessions','recognition_results','achievements','user_achievements'
    ] LOOP
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
    END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.signs, public.courses, public.lessons, public.lesson_signs,
    public.exercises, public.achievements TO anon, authenticated;
GRANT SELECT ON public.profiles, public.enrollments, public.lesson_progress, public.exercise_attempts,
    public.practice_attempts, public.recognition_sessions, public.recognition_results,
    public.user_achievements TO authenticated;
GRANT UPDATE (display_name, timezone) ON public.profiles TO authenticated;
--> statement-breakpoint
CREATE FUNCTION asignx_private.validate_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
        RAISE EXCEPTION 'Invalid IANA timezone' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER profiles_validate BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION asignx_private.validate_profile();
--> statement-breakpoint
-- Signup metadata never controls the application role.
CREATE FUNCTION asignx_private.create_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.profiles(id, display_name)
    VALUES (NEW.id, left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
        nullif(btrim(NEW.raw_user_meta_data->>'name'), ''), 'ASL explorer'), 100))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END $$;
CREATE TRIGGER asignx_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION asignx_private.create_profile();
-- Existing identities also need application profiles when upgrading a project.
INSERT INTO public.profiles(id, display_name)
SELECT id, left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(raw_user_meta_data->>'name'), ''), 'ASL explorer'), 100)
FROM auth.users ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION asignx_private.guard_enrollment() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.course_id IS DISTINCT FROM OLD.course_id OR NEW.enrolled_at IS DISTINCT FROM OLD.enrolled_at THEN
        RAISE EXCEPTION 'Enrollment identity is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER enrollments_immutable BEFORE UPDATE ON public.enrollments
    FOR EACH ROW EXECUTE FUNCTION asignx_private.guard_enrollment();
--> statement-breakpoint
CREATE FUNCTION asignx_private.validate_progress() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE reward integer;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.completed_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.enrollments WHERE id = OLD.enrollment_id) THEN
            RAISE EXCEPTION 'Completed progress cannot be deleted independently of its enrollment' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
            OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
            RAISE EXCEPTION 'Progress identity and start time are immutable' USING ERRCODE = '23514';
        END IF;
        IF OLD.completed_at IS NOT NULL THEN
            IF NEW.completed_at IS DISTINCT FROM OLD.completed_at OR NEW.xp_earned IS DISTINCT FROM OLD.xp_earned THEN
                RAISE EXCEPTION 'Completed XP and time are immutable' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END IF;
    END IF;
    SELECT l.xp_reward INTO reward FROM public.lessons l
        JOIN public.enrollments e ON e.course_id = l.course_id
        WHERE l.id = NEW.lesson_id AND e.id = NEW.enrollment_id FOR SHARE OF l;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lesson does not belong to enrollment course' USING ERRCODE = '23514'; END IF;
    IF NEW.completed_at IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.exercises x WHERE x.lesson_id = NEW.lesson_id
            AND NOT EXISTS (SELECT 1 FROM public.exercise_attempts a WHERE a.enrollment_id = NEW.enrollment_id
                AND a.exercise_id = x.id AND a.is_correct)) THEN
            RAISE EXCEPTION 'Each exercise must be answered correctly before completion' USING ERRCODE = '23514';
        END IF;
        NEW.xp_earned := reward;
    ELSE NEW.xp_earned := 0;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER lesson_progress_validate BEFORE INSERT OR UPDATE OR DELETE ON public.lesson_progress
    FOR EACH ROW EXECUTE FUNCTION asignx_private.validate_progress();
--> statement-breakpoint
CREATE FUNCTION asignx_private.grade_exercise() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.exercises x JOIN public.lessons l ON l.id = x.lesson_id
        JOIN public.enrollments e ON e.course_id = l.course_id
        WHERE x.id = NEW.exercise_id AND e.id = NEW.enrollment_id) THEN
        RAISE EXCEPTION 'Exercise does not belong to enrollment course' USING ERRCODE = '23514';
    END IF;
    SELECT o.is_correct INTO NEW.is_correct FROM public.exercise_options o
        WHERE o.id = NEW.selected_option_id AND o.exercise_id = NEW.exercise_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Option does not belong to exercise' USING ERRCODE = '23503'; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER exercise_attempts_grade BEFORE INSERT ON public.exercise_attempts
    FOR EACH ROW EXECUTE FUNCTION asignx_private.grade_exercise();
--> statement-breakpoint
CREATE FUNCTION asignx_private.grade_practice() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE threshold numeric;
BEGIN
    IF NEW.lesson_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.lessons l JOIN public.enrollments e ON e.course_id = l.course_id
        JOIN public.lesson_signs ls ON ls.lesson_id = l.id
        WHERE l.id = NEW.lesson_id AND e.user_id = NEW.user_id AND ls.sign_id = NEW.target_sign_id
    ) THEN RAISE EXCEPTION 'Lesson practice requires enrollment and a lesson target sign' USING ERRCODE = '23514'; END IF;
    SELECT confidence_threshold INTO threshold FROM public.model_versions WHERE id = NEW.model_version_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown model version' USING ERRCODE = '23503'; END IF;
    NEW.is_correct := coalesce(NEW.predicted_sign_id = NEW.target_sign_id AND NEW.confidence >= threshold, false);
    RETURN NEW;
END $$;
CREATE TRIGGER practice_attempts_grade BEFORE INSERT ON public.practice_attempts
    FOR EACH ROW EXECUTE FUNCTION asignx_private.grade_practice();
--> statement-breakpoint
CREATE FUNCTION asignx_private.reject_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION '% records are immutable; create a new record', TG_TABLE_NAME USING ERRCODE = '23514'; END $$;
CREATE TRIGGER model_versions_immutable BEFORE UPDATE ON public.model_versions
    FOR EACH ROW EXECUTE FUNCTION asignx_private.reject_update();
CREATE TRIGGER exercise_attempts_immutable BEFORE UPDATE ON public.exercise_attempts
    FOR EACH ROW EXECUTE FUNCTION asignx_private.reject_update();
CREATE TRIGGER practice_attempts_immutable BEFORE UPDATE ON public.practice_attempts
    FOR EACH ROW EXECUTE FUNCTION asignx_private.reject_update();
CREATE TRIGGER recognition_results_immutable BEFORE UPDATE ON public.recognition_results
    FOR EACH ROW EXECUTE FUNCTION asignx_private.reject_update();
CREATE TRIGGER user_achievements_immutable BEFORE UPDATE ON public.user_achievements
    FOR EACH ROW EXECUTE FUNCTION asignx_private.reject_update();
--> statement-breakpoint
-- Lock the lesson while editing questions or publishing to prevent publication races.
CREATE FUNCTION asignx_private.guard_quiz_definition() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_exercise_id uuid; v_lesson_id uuid; published boolean;
BEGIN
    IF TG_TABLE_NAME = 'exercises' THEN
        IF TG_OP <> 'INSERT' THEN v_exercise_id := OLD.id; v_lesson_id := OLD.lesson_id;
        ELSE v_exercise_id := NEW.id; v_lesson_id := NEW.lesson_id; END IF;
    ELSE
        IF TG_OP <> 'INSERT' THEN v_exercise_id := OLD.exercise_id; ELSE v_exercise_id := NEW.exercise_id; END IF;
        SELECT x.lesson_id INTO v_lesson_id FROM public.exercises x WHERE x.id = v_exercise_id;
    END IF;
    SELECT l.is_published INTO published FROM public.lessons l WHERE l.id = v_lesson_id FOR UPDATE;
    IF published OR EXISTS (SELECT 1 FROM public.exercise_attempts a WHERE a.exercise_id = v_exercise_id)
        OR EXISTS (SELECT 1 FROM public.lesson_progress p WHERE p.lesson_id = v_lesson_id AND p.completed_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Published or used quiz definitions are frozen; create a new lesson/exercise version' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'exercises' THEN
            IF NEW.lesson_id IS DISTINCT FROM OLD.lesson_id THEN
                RAISE EXCEPTION 'Exercise lesson is immutable' USING ERRCODE = '23514';
            END IF;
        ELSE
            IF NEW.exercise_id IS DISTINCT FROM OLD.exercise_id THEN
                RAISE EXCEPTION 'Option exercise is immutable' USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER exercises_guard BEFORE INSERT OR UPDATE OR DELETE ON public.exercises
    FOR EACH ROW EXECUTE FUNCTION asignx_private.guard_quiz_definition();
CREATE TRIGGER exercise_options_guard BEFORE INSERT OR UPDATE OR DELETE ON public.exercise_options
    FOR EACH ROW EXECUTE FUNCTION asignx_private.guard_quiz_definition();
--> statement-breakpoint
CREATE FUNCTION asignx_private.validate_publication() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.lessons WHERE id = NEW.id AND is_published) AND EXISTS (
        SELECT 1 FROM public.exercises x LEFT JOIN public.exercise_options o ON o.exercise_id = x.id
        WHERE x.lesson_id = NEW.id GROUP BY x.id HAVING count(o.id) < 2 OR count(o.id) FILTER (WHERE o.is_correct) <> 1
    ) THEN RAISE EXCEPTION 'Published exercises require at least two options and exactly one correct option' USING ERRCODE = '23514'; END IF;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER lessons_validate_publication AFTER INSERT OR UPDATE ON public.lessons
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION asignx_private.validate_publication();
--> statement-breakpoint
CREATE FUNCTION asignx_private.guard_lesson_course() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.course_id IS DISTINCT FROM OLD.course_id THEN
        RAISE EXCEPTION 'Lesson identity and course are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER lessons_guard_course BEFORE UPDATE ON public.lessons
    FOR EACH ROW EXECUTE FUNCTION asignx_private.guard_lesson_course();
--> statement-breakpoint
CREATE FUNCTION asignx_private.guard_recognition_result() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE ended timestamptz;
BEGIN
    SELECT ended_at INTO ended FROM public.recognition_sessions WHERE id = NEW.session_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown recognition session' USING ERRCODE = '23503'; END IF;
    IF ended IS NOT NULL THEN RAISE EXCEPTION 'Cannot append to an ended recognition session' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER recognition_results_guard BEFORE INSERT ON public.recognition_results
    FOR EACH ROW EXECUTE FUNCTION asignx_private.guard_recognition_result();
--> statement-breakpoint
CREATE FUNCTION asignx_private.finalize_recognition() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.ended_at IS NOT NULL OR NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
            OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
            RAISE EXCEPTION 'Session identity and ended sessions are immutable' USING ERRCODE = '23514';
        END IF;
    END IF;
    IF NEW.ended_at IS NOT NULL THEN
        SELECT coalesce(string_agg(s.meaning, ' ' ORDER BY r.sequence_no), '') INTO NEW.final_text
        FROM public.recognition_results r JOIN public.signs s ON s.id = r.sign_id
        JOIN public.model_versions m ON m.id = r.model_version_id
        WHERE r.session_id = NEW.id AND r.confidence >= m.confidence_threshold;
    ELSE NEW.final_text := NULL;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER recognition_sessions_finalize BEFORE INSERT OR UPDATE ON public.recognition_sessions
    FOR EACH ROW EXECUTE FUNCTION asignx_private.finalize_recognition();
--> statement-breakpoint
CREATE FUNCTION asignx_private.current_streak(learner uuid) RETURNS integer
LANGUAGE sql STABLE SET search_path = '' AS $$
    WITH days AS (
        SELECT (p.completed_at AT TIME ZONE u.timezone)::date AS day
        FROM public.lesson_progress p JOIN public.enrollments e ON e.id = p.enrollment_id
        JOIN public.profiles u ON u.id = e.user_id WHERE u.id = learner AND p.completed_at IS NOT NULL
        UNION
        SELECT (a.attempted_at AT TIME ZONE u.timezone)::date FROM public.practice_attempts a
        JOIN public.profiles u ON u.id = a.user_id WHERE u.id = learner AND a.is_correct
    ), numbered AS (
        SELECT day, row_number() OVER (ORDER BY day DESC)::integer AS n, max(day) OVER () AS last_day FROM days
    )
    SELECT count(*)::integer FROM numbered
    WHERE day = last_day - (n - 1)
        AND last_day BETWEEN (SELECT (now() AT TIME ZONE timezone)::date - 1 FROM public.profiles WHERE id = learner)
        AND (SELECT (now() AT TIME ZONE timezone)::date FROM public.profiles WHERE id = learner)
$$;
--> statement-breakpoint
CREATE FUNCTION asignx_private.validate_achievement() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE metric text; target integer; actual bigint;
BEGIN
    SELECT a.metric, a.threshold INTO metric, target FROM public.achievements a WHERE a.id = NEW.achievement_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown achievement' USING ERRCODE = '23503'; END IF;
    CASE metric
        WHEN 'completed_lessons' THEN SELECT count(*) INTO actual FROM public.lesson_progress p
            JOIN public.enrollments e ON e.id = p.enrollment_id WHERE e.user_id = NEW.user_id AND p.completed_at IS NOT NULL;
        WHEN 'total_xp' THEN SELECT coalesce(sum(p.xp_earned), 0) INTO actual FROM public.lesson_progress p
            JOIN public.enrollments e ON e.id = p.enrollment_id WHERE e.user_id = NEW.user_id AND p.completed_at IS NOT NULL;
        WHEN 'successful_practices' THEN SELECT count(*) INTO actual FROM public.practice_attempts WHERE user_id = NEW.user_id AND is_correct;
        WHEN 'streak_days' THEN actual := asignx_private.current_streak(NEW.user_id);
    END CASE;
    IF actual < target THEN RAISE EXCEPTION 'Achievement threshold has not been met' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER user_achievements_validate BEFORE INSERT ON public.user_achievements
    FOR EACH ROW EXECUTE FUNCTION asignx_private.validate_achievement();
--> statement-breakpoint
CREATE FUNCTION asignx_private.guard_achievement_definition() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE achievement_id = OLD.id) THEN
        RAISE EXCEPTION 'Awarded achievement definitions are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER achievements_guard BEFORE UPDATE ON public.achievements
    FOR EACH ROW EXECUTE FUNCTION asignx_private.guard_achievement_definition();
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA asignx_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA asignx_private TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA asignx_private TO service_role;
