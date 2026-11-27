-- Stop before removing historical records that may need retention.
LOCK TABLE public.practice_attempts, public.recognition_sessions, public.recognition_results IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM public.practice_attempts) OR EXISTS (SELECT 1 FROM public.recognition_sessions)
       OR EXISTS (SELECT 1 FROM public.recognition_results) THEN
        RAISE EXCEPTION 'Legacy practice or recognition history exists. Review retention before applying this migration.';
    END IF;
END $$;

ALTER TABLE public.heart_practice_rounds RENAME TO practice_rounds;
ALTER TABLE public.heart_practice_questions RENAME TO practice_round_questions;
ALTER TABLE public.heart_practice_submissions RENAME TO practice_submissions;
ALTER TABLE public.practice_rounds ADD COLUMN heart_restored boolean NOT NULL DEFAULT false;
ALTER INDEX public.heart_practice_one_active RENAME TO practice_one_active;
ALTER INDEX public.heart_practice_one_correct RENAME TO practice_one_correct;
ALTER TABLE public.practice_round_questions RENAME CONSTRAINT heart_practice_question_index TO practice_question_index;
ALTER TABLE public.practice_round_questions RENAME CONSTRAINT heart_practice_questions_pkey TO practice_round_questions_pkey;
ALTER TABLE public.practice_submissions RENAME CONSTRAINT heart_practice_submissions_pkey TO practice_submissions_pkey;
ALTER TABLE public.practice_rounds RENAME CONSTRAINT heart_practice_rounds_pkey TO practice_rounds_pkey;
ALTER TABLE public.practice_rounds RENAME CONSTRAINT heart_practice_rounds_user_id_profiles_id_fkey TO practice_rounds_user_id_profiles_id_fkey;
ALTER TABLE public.practice_round_questions RENAME CONSTRAINT heart_practice_questions_round_id_heart_practice_rounds_id_fkey TO practice_round_questions_round_id_practice_rounds_id_fkey;
ALTER TABLE public.practice_round_questions RENAME CONSTRAINT heart_practice_questions_exercise_id_exercises_id_fkey TO practice_round_questions_exercise_id_exercises_id_fkey;
ALTER TABLE public.practice_submissions RENAME CONSTRAINT "heart_practice_submissions_vY4ppCDwpMJu_fkey" TO "practice_submissions_zVn33Ig5J4FH_fkey";
ALTER TABLE public.practice_submissions RENAME CONSTRAINT "heart_practice_submissions_3Mp8TKvuqQvt_fkey" TO "practice_submissions_uOoQpnAkNLSY_fkey";

CREATE FUNCTION asignx_private.practice_round_succeeded(round_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
    SELECT count(*) = 3 FROM public.practice_submissions s WHERE s.round_id = $1 AND s.is_correct
$$;


CREATE OR REPLACE FUNCTION asignx_private.grade_exercise() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE kind text; target text; BEGIN
 SELECT x.answer_type,s.gloss INTO kind,target FROM public.exercises x JOIN public.lessons l ON l.id=x.lesson_id JOIN public.enrollments e ON e.course_id=l.course_id LEFT JOIN public.signs s ON s.id=x.sign_id WHERE x.id=NEW.exercise_id AND e.id=NEW.enrollment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exercise does not belong to enrollment course' USING ERRCODE='23514'; END IF;
 IF kind='recognition' THEN
  IF NEW.selected_option_id IS NOT NULL OR NEW.response_text IS NULL OR NEW.recognition_confidence IS NULL OR NEW.recognition_confidence NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Invalid recognition evidence' USING ERRCODE='23514'; END IF;
  NEW.is_correct:=coalesce(NEW.response_text=target AND NEW.recognition_confidence>=0.8,false);
 ELSE
  IF NEW.recognition_confidence IS NOT NULL THEN RAISE EXCEPTION 'Recognition evidence on choice question' USING ERRCODE='23514'; END IF;
  SELECT is_correct INTO NEW.is_correct FROM public.exercise_options WHERE id=NEW.selected_option_id AND exercise_id=NEW.exercise_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Option does not belong to exercise' USING ERRCODE='23503'; END IF;
 END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION asignx_private.grade_practice_answer() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 SELECT o.is_correct INTO NEW.is_correct FROM public.practice_round_questions q JOIN public.exercise_options o ON o.exercise_id=q.exercise_id WHERE q.round_id=NEW.round_id AND q.question_index=NEW.question_index AND o.id=NEW.selected_option_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Practice answer does not belong to question' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION asignx_private.current_streak(learner uuid) RETURNS integer
LANGUAGE sql STABLE SET search_path = '' AS $$
    WITH days AS (
        SELECT (p.completed_at AT TIME ZONE u.timezone)::date AS day
        FROM public.lesson_progress p JOIN public.enrollments e ON e.id = p.enrollment_id
        JOIN public.profiles u ON u.id = e.user_id WHERE u.id = learner AND p.completed_at IS NOT NULL
        UNION
        SELECT (a.completed_at AT TIME ZONE u.timezone)::date FROM public.practice_rounds a
        JOIN public.profiles u ON u.id = a.user_id WHERE u.id = learner AND a.completed_at IS NOT NULL AND asignx_private.practice_round_succeeded(a.id)
    ), numbered AS (
        SELECT day, row_number() OVER (ORDER BY day DESC)::integer AS n, max(day) OVER () AS last_day FROM days
    )
    SELECT count(*)::integer FROM numbered
    WHERE day = last_day - (n - 1)
        AND last_day BETWEEN (SELECT (now() AT TIME ZONE timezone)::date - 1 FROM public.profiles WHERE id = learner)
        AND (SELECT (now() AT TIME ZONE timezone)::date FROM public.profiles WHERE id = learner)
$$;


CREATE OR REPLACE FUNCTION asignx_private.validate_achievement() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE metric text; target integer; actual bigint;
BEGIN
    SELECT a.metric, a.threshold INTO metric, target FROM public.achievements a WHERE a.id = NEW.achievement_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown achievement' USING ERRCODE = '23503'; END IF;
    CASE metric
        WHEN 'completed_lessons' THEN SELECT count(*) INTO actual FROM public.lesson_progress p
            JOIN public.enrollments e ON e.id = p.enrollment_id WHERE e.user_id = NEW.user_id AND p.completed_at IS NOT NULL;
        WHEN 'total_xp' THEN SELECT coalesce(sum(a.amount),0) INTO actual FROM public.xp_awards a JOIN public.enrollments e ON e.id=a.enrollment_id WHERE e.user_id=NEW.user_id;
        WHEN 'successful_practices' THEN SELECT count(*) INTO actual FROM public.practice_rounds r WHERE r.user_id = NEW.user_id AND r.completed_at IS NOT NULL AND asignx_private.practice_round_succeeded(r.id);
        WHEN 'streak_days' THEN actual := asignx_private.current_streak(NEW.user_id);
    END CASE;
    IF actual < target THEN RAISE EXCEPTION 'Achievement threshold has not been met' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END $$;
DROP TRIGGER heart_practice_submissions_grade ON public.practice_submissions;

CREATE TRIGGER practice_submissions_grade BEFORE INSERT ON public.practice_submissions
    FOR EACH ROW EXECUTE FUNCTION asignx_private.grade_practice_answer();
ALTER TRIGGER heart_practice_submissions_immutable ON public.practice_submissions RENAME TO practice_submissions_immutable;
DROP FUNCTION asignx_private.grade_heart_answer();

-- Preserve the historical version label before removing the lookup table.
LOCK TABLE public.model_versions IN SHARE MODE;
ALTER TABLE public.exercise_attempts ADD COLUMN model_version varchar(50);
ALTER TABLE public.exercise_attempts DISABLE TRIGGER exercise_attempts_immutable;
UPDATE public.exercise_attempts AS attempt
SET model_version = model.version
FROM public.model_versions AS model
WHERE attempt.model_version_id = model.id;
ALTER TABLE public.exercise_attempts ENABLE TRIGGER exercise_attempts_immutable;
ALTER TABLE public.exercise_attempts DROP COLUMN model_version_id;
DROP TABLE public.recognition_results, public.recognition_sessions, public.practice_attempts, public.model_versions;
DROP FUNCTION asignx_private.grade_practice();
DROP FUNCTION asignx_private.guard_recognition_result();
DROP FUNCTION asignx_private.finalize_recognition();
