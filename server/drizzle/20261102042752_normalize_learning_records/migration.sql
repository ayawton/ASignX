-- Backfill before removing compatibility storage. The migration runner is transactional.
CREATE TEMP TABLE normalization_xp_before AS
SELECT e.id AS enrollment_id,coalesce((SELECT sum(p.xp_earned) FROM lesson_progress p WHERE p.enrollment_id=e.id),0)+coalesce((SELECT sum(r.xp_earned) FROM lesson_runs r WHERE r.enrollment_id=e.id AND r.completed_at IS NOT NULL),0) AS total FROM enrollments e;
--> statement-breakpoint
CREATE TABLE xp_awards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
 run_id uuid REFERENCES lesson_runs(id) ON DELETE CASCADE,exercise_id uuid REFERENCES exercises(id) ON DELETE RESTRICT,source varchar(20) NOT NULL,amount integer NOT NULL CONSTRAINT xp_awards_nonnegative CHECK(amount>=0),awarded_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT xp_awards_source CHECK(source IN('legacy','claim','run_import','first_question','replay','material'))
);
ALTER TABLE xp_awards ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX xp_awards_first_claim ON xp_awards(enrollment_id,exercise_id) WHERE source IN('claim','first_question');
CREATE UNIQUE INDEX xp_awards_run_total ON xp_awards(run_id) WHERE source IN('run_import','replay','material');
CREATE INDEX xp_awards_enrollment_idx ON xp_awards(enrollment_id);
CREATE INDEX xp_awards_run_idx ON xp_awards(run_id);
INSERT INTO xp_awards(enrollment_id,lesson_id,source,amount,awarded_at) SELECT enrollment_id,lesson_id,'legacy',xp_earned,coalesce(completed_at,started_at) FROM lesson_progress WHERE xp_earned>0;
INSERT INTO xp_awards(enrollment_id,lesson_id,run_id,source,amount,awarded_at) SELECT enrollment_id,lesson_id,id,'run_import',xp_earned,completed_at FROM lesson_runs WHERE completed_at IS NOT NULL;
INSERT INTO xp_awards(enrollment_id,lesson_id,exercise_id,source,amount,awarded_at) SELECT w.enrollment_id,x.lesson_id,w.exercise_id,'claim',0,w.awarded_at FROM lesson_question_rewards w JOIN exercises x ON x.id=w.exercise_id;
--> statement-breakpoint
CREATE TABLE heart_practice_questions(round_id uuid NOT NULL REFERENCES heart_practice_rounds(id) ON DELETE CASCADE,question_index integer NOT NULL CONSTRAINT heart_practice_question_index CHECK(question_index BETWEEN 0 AND 2),exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,PRIMARY KEY(round_id,question_index));
CREATE TABLE heart_practice_submissions(id uuid PRIMARY KEY,round_id uuid NOT NULL,question_index integer NOT NULL,selected_option_id uuid NOT NULL REFERENCES exercise_options(id) ON DELETE RESTRICT,is_correct boolean NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(round_id,question_index) REFERENCES heart_practice_questions(round_id,question_index) ON DELETE CASCADE);
CREATE UNIQUE INDEX heart_practice_one_correct ON heart_practice_submissions(round_id,question_index) WHERE is_correct;
ALTER TABLE heart_practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE heart_practice_submissions ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE r record; qs jsonb; ss jsonb; item jsonb; idx integer; option_correct boolean; target uuid; BEGIN
 FOR r IN SELECT * FROM heart_practice_rounds LOOP
  qs:=CASE WHEN jsonb_typeof(r.questions)='string' THEN (r.questions#>>'{}')::jsonb ELSE r.questions END;
  ss:=CASE WHEN jsonb_typeof(r.submissions)='string' THEN (r.submissions#>>'{}')::jsonb ELSE r.submissions END;
  IF jsonb_typeof(qs)<>'array' OR jsonb_array_length(qs)<>3 OR jsonb_typeof(ss)<>'array' THEN RAISE EXCEPTION 'Unmappable heart practice round %',r.id; END IF;
  FOR idx IN 0..2 LOOP INSERT INTO heart_practice_questions VALUES(r.id,idx,(qs->>idx)::uuid); END LOOP;
  idx:=0;
  FOR item IN SELECT value FROM jsonb_array_elements(ss) LOOP
   IF idx>2 THEN RAISE EXCEPTION 'Extra answers in completed practice round %',r.id; END IF;
   target:=(qs->>idx)::uuid;
   SELECT is_correct INTO option_correct FROM exercise_options WHERE id=(item->>'option')::uuid AND exercise_id=target;
   IF NOT FOUND OR option_correct IS DISTINCT FROM (item->>'correct')::boolean THEN RAISE EXCEPTION 'Unmappable practice answer in %',r.id; END IF;
   INSERT INTO heart_practice_submissions VALUES((item->>'id')::uuid,r.id,idx,(item->>'option')::uuid,option_correct,r.created_at);
   IF option_correct THEN idx:=idx+1; END IF;
  END LOOP;
  IF idx<>r.correct_count THEN RAISE EXCEPTION 'Practice score mismatch for %',r.id; END IF;
 END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE model_versions ADD COLUMN fingerprint varchar(128) CONSTRAINT model_versions_fingerprint_unique UNIQUE;
ALTER TABLE model_versions ALTER COLUMN artifact_path DROP NOT NULL;
ALTER TABLE model_versions DROP CONSTRAINT model_versions_artifact_nonblank;
ALTER TABLE model_versions ADD CONSTRAINT model_versions_artifact_nonblank CHECK(artifact_path IS NULL OR length(btrim(artifact_path))>0);
ALTER TABLE exercise_attempts ADD COLUMN model_version_id uuid REFERENCES model_versions(id) ON DELETE RESTRICT;
ALTER TABLE exercise_attempts ALTER COLUMN selected_option_id DROP NOT NULL;
INSERT INTO model_versions(version,artifact_path,fingerprint) SELECT gen_random_uuid()::text,NULL,recognition_model FROM exercise_attempts WHERE recognition_model IS NOT NULL GROUP BY recognition_model;
ALTER TABLE exercise_attempts DISABLE TRIGGER exercise_attempts_immutable;
UPDATE exercise_attempts a SET model_version_id=m.id FROM model_versions m WHERE m.fingerprint=a.recognition_model;
UPDATE exercise_attempts a SET selected_option_id=NULL FROM exercises x WHERE x.id=a.exercise_id AND x.answer_type='recognition';
ALTER TABLE exercise_attempts ENABLE TRIGGER exercise_attempts_immutable;
ALTER TABLE exercise_options DISABLE TRIGGER exercise_options_guard;
DELETE FROM exercise_options o USING exercises x WHERE x.id=o.exercise_id AND x.answer_type='recognition';
ALTER TABLE exercise_options ENABLE TRIGGER exercise_options_guard;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION asignx_private.grade_exercise() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE kind text; target text; threshold numeric; BEGIN
 SELECT x.answer_type,s.gloss INTO kind,target FROM public.exercises x JOIN public.lessons l ON l.id=x.lesson_id JOIN public.enrollments e ON e.course_id=l.course_id LEFT JOIN public.signs s ON s.id=x.sign_id WHERE x.id=NEW.exercise_id AND e.id=NEW.enrollment_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exercise does not belong to enrollment course' USING ERRCODE='23514'; END IF;
 IF kind='recognition' THEN
  IF NEW.selected_option_id IS NOT NULL OR NEW.model_version_id IS NULL OR NEW.response_text IS NULL OR NEW.recognition_confidence IS NULL OR NEW.recognition_confidence NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Invalid recognition evidence' USING ERRCODE='23514'; END IF;
  SELECT confidence_threshold INTO threshold FROM public.model_versions WHERE id=NEW.model_version_id;
  NEW.is_correct:=coalesce(NEW.response_text=target AND NEW.recognition_confidence>=threshold,false);
 ELSE
  IF NEW.model_version_id IS NOT NULL OR NEW.recognition_confidence IS NOT NULL THEN RAISE EXCEPTION 'Recognition evidence on choice question' USING ERRCODE='23514'; END IF;
  SELECT is_correct INTO NEW.is_correct FROM public.exercise_options WHERE id=NEW.selected_option_id AND exercise_id=NEW.exercise_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Option does not belong to exercise' USING ERRCODE='23503'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION asignx_private.validate_publication() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.lessons WHERE id=NEW.id AND is_published) AND EXISTS(
 SELECT x.id FROM public.exercises x LEFT JOIN public.exercise_options o ON o.exercise_id=x.id WHERE x.lesson_id=NEW.id GROUP BY x.id HAVING
 (x.answer_type<>'recognition' AND (count(o.id)<2 OR count(o.id) FILTER(WHERE o.is_correct)<>1)) OR
 (x.answer_type='recognition' AND (count(o.id)<>0 OR NOT EXISTS(SELECT 1 FROM public.lesson_signs ls JOIN public.signs s ON s.id=ls.sign_id WHERE ls.lesson_id=NEW.id AND s.id=x.sign_id AND s.is_published)))
 ) THEN RAISE EXCEPTION 'Published question configuration is invalid' USING ERRCODE='23514'; END IF; RETURN NULL; END $$;
--> statement-breakpoint
CREATE FUNCTION asignx_private.validate_run_question() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE enrollment uuid; lesson uuid; BEGIN
 IF TG_OP='UPDATE' AND (NEW.run_id IS DISTINCT FROM OLD.run_id OR NEW.exercise_id IS DISTINCT FROM OLD.exercise_id OR NEW.xp_value IS DISTINCT FROM OLD.xp_value OR NEW.sort_order IS DISTINCT FROM OLD.sort_order OR (OLD.attempt_id IS NOT NULL AND NEW.attempt_id IS DISTINCT FROM OLD.attempt_id)) THEN RAISE EXCEPTION 'Run question snapshot is immutable' USING ERRCODE='23514'; END IF;
 SELECT enrollment_id,lesson_id INTO enrollment,lesson FROM public.lesson_runs WHERE id=NEW.run_id;
 IF NOT EXISTS(SELECT 1 FROM public.exercises WHERE id=NEW.exercise_id AND lesson_id=lesson) THEN RAISE EXCEPTION 'Run question lesson mismatch' USING ERRCODE='23514'; END IF;
 IF NEW.attempt_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.exercise_attempts WHERE id=NEW.attempt_id AND exercise_id=NEW.exercise_id AND enrollment_id=enrollment) THEN RAISE EXCEPTION 'Run answer ownership mismatch' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER lesson_run_questions_validate BEFORE INSERT OR UPDATE ON lesson_run_questions FOR EACH ROW EXECUTE FUNCTION asignx_private.validate_run_question();
CREATE FUNCTION asignx_private.validate_run_parent() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.replay IS DISTINCT FROM OLD.replay) THEN RAISE EXCEPTION 'Run identity is immutable' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.enrollments e JOIN public.lessons l ON l.course_id=e.course_id WHERE e.id=NEW.enrollment_id AND l.id=NEW.lesson_id) THEN RAISE EXCEPTION 'Run enrollment lesson mismatch' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER lesson_runs_validate BEFORE INSERT OR UPDATE ON lesson_runs FOR EACH ROW EXECUTE FUNCTION asignx_private.validate_run_parent();
CREATE FUNCTION asignx_private.validate_xp_award() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.enrollments e JOIN public.lessons l ON l.course_id=e.course_id WHERE e.id=NEW.enrollment_id AND l.id=NEW.lesson_id) OR
 (NEW.run_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lesson_runs WHERE id=NEW.run_id AND enrollment_id=NEW.enrollment_id AND lesson_id=NEW.lesson_id)) OR
 (NEW.exercise_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.exercises WHERE id=NEW.exercise_id AND lesson_id=NEW.lesson_id)) THEN RAISE EXCEPTION 'XP award relationship mismatch' USING ERRCODE='23514'; END IF;
 IF (NEW.source IN('claim','first_question') AND NEW.exercise_id IS NULL) OR (NEW.source IN('run_import','first_question','replay','material') AND NEW.run_id IS NULL) THEN RAISE EXCEPTION 'XP award source mismatch' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER xp_awards_validate BEFORE INSERT ON xp_awards FOR EACH ROW EXECUTE FUNCTION asignx_private.validate_xp_award();
CREATE TRIGGER xp_awards_immutable BEFORE UPDATE ON xp_awards FOR EACH ROW EXECUTE FUNCTION asignx_private.reject_update();
CREATE FUNCTION asignx_private.grade_heart_answer() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 SELECT o.is_correct INTO NEW.is_correct FROM public.heart_practice_questions q JOIN public.exercise_options o ON o.exercise_id=q.exercise_id WHERE q.round_id=NEW.round_id AND q.question_index=NEW.question_index AND o.id=NEW.selected_option_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Heart answer does not belong to question' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER heart_practice_submissions_grade BEFORE INSERT ON heart_practice_submissions FOR EACH ROW EXECUTE FUNCTION asignx_private.grade_heart_answer();
CREATE TRIGGER heart_practice_submissions_immutable BEFORE UPDATE ON heart_practice_submissions FOR EACH ROW EXECUTE FUNCTION asignx_private.reject_update();
--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM lesson_runs r JOIN enrollments e ON e.id=r.enrollment_id JOIN lessons l ON l.id=r.lesson_id WHERE e.course_id<>l.course_id) OR
 EXISTS(SELECT 1 FROM lesson_run_questions q JOIN lesson_runs r ON r.id=q.run_id JOIN exercises x ON x.id=q.exercise_id LEFT JOIN exercise_attempts a ON a.id=q.attempt_id WHERE x.lesson_id<>r.lesson_id OR (q.attempt_id IS NOT NULL AND (a.exercise_id<>q.exercise_id OR a.enrollment_id<>r.enrollment_id))) THEN RAISE EXCEPTION 'Existing run relationships are inconsistent'; END IF;
 IF EXISTS(SELECT 1 FROM normalization_xp_before b WHERE b.total<>(SELECT coalesce(sum(amount),0) FROM xp_awards a WHERE a.enrollment_id=b.enrollment_id)) THEN RAISE EXCEPTION 'XP totals changed during normalization'; END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION asignx_private.validate_progress() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.completed_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.enrollments WHERE id=OLD.enrollment_id) THEN RAISE EXCEPTION 'Completed progress cannot be deleted independently of its enrollment' USING ERRCODE='23514'; END IF; RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN RAISE EXCEPTION 'Progress identity and start time are immutable' USING ERRCODE='23514'; END IF;
  IF OLD.completed_at IS NOT NULL THEN IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN RAISE EXCEPTION 'Completed time is immutable' USING ERRCODE='23514'; END IF; RETURN NEW; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.lessons l JOIN public.enrollments e ON e.course_id=l.course_id WHERE l.id=NEW.lesson_id AND e.id=NEW.enrollment_id) THEN RAISE EXCEPTION 'Lesson does not belong to enrollment course' USING ERRCODE='23514'; END IF;
 IF NEW.completed_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lesson_runs r WHERE r.enrollment_id=NEW.enrollment_id AND r.lesson_id=NEW.lesson_id AND r.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'A finalized lesson run is required before completion' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
--> statement-breakpoint
ALTER TABLE lesson_progress DROP CONSTRAINT lesson_progress_completion_valid;
ALTER TABLE lesson_progress DROP CONSTRAINT lesson_progress_xp_nonnegative;
ALTER TABLE lesson_progress DROP COLUMN xp_earned;
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_completion_valid CHECK(completed_at IS NULL OR completed_at>=started_at);
ALTER TABLE lesson_runs DROP CONSTRAINT lesson_runs_xp_nonnegative;
ALTER TABLE lesson_runs DROP COLUMN xp_earned;
ALTER TABLE heart_practice_rounds DROP CONSTRAINT heart_practice_correct_range;
ALTER TABLE heart_practice_rounds DROP COLUMN questions,DROP COLUMN submissions,DROP COLUMN correct_count;
ALTER TABLE exercise_attempts DROP COLUMN recognition_model;
DROP TABLE lesson_question_rewards;
DROP TABLE normalization_xp_before;

--> statement-breakpoint
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
        WHEN 'successful_practices' THEN SELECT count(*) INTO actual FROM public.practice_attempts WHERE user_id = NEW.user_id AND is_correct;
        WHEN 'streak_days' THEN actual := asignx_private.current_streak(NEW.user_id);
    END CASE;
    IF actual < target THEN RAISE EXCEPTION 'Achievement threshold has not been met' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END $$;

--> statement-breakpoint
ALTER TABLE exercise_attempts RENAME CONSTRAINT exercise_attempts_model_version_id_fkey TO "exercise_attempts_model_version_id_model_versions_id_fkey";
ALTER TABLE heart_practice_questions RENAME CONSTRAINT heart_practice_questions_round_id_fkey TO "heart_practice_questions_round_id_heart_practice_rounds_id_fkey";
ALTER TABLE heart_practice_questions RENAME CONSTRAINT heart_practice_questions_exercise_id_fkey TO "heart_practice_questions_exercise_id_exercises_id_fkey";
ALTER TABLE heart_practice_submissions RENAME CONSTRAINT heart_practice_submissions_selected_option_id_fkey TO "heart_practice_submissions_vY4ppCDwpMJu_fkey";
ALTER TABLE heart_practice_submissions RENAME CONSTRAINT heart_practice_submissions_round_id_question_index_fkey TO "heart_practice_submissions_3Mp8TKvuqQvt_fkey";
ALTER TABLE xp_awards RENAME CONSTRAINT xp_awards_enrollment_id_fkey TO "xp_awards_enrollment_id_enrollments_id_fkey";
ALTER TABLE xp_awards RENAME CONSTRAINT xp_awards_lesson_id_fkey TO "xp_awards_lesson_id_lessons_id_fkey";
ALTER TABLE xp_awards RENAME CONSTRAINT xp_awards_run_id_fkey TO "xp_awards_run_id_lesson_runs_id_fkey";
ALTER TABLE xp_awards RENAME CONSTRAINT xp_awards_exercise_id_fkey TO "xp_awards_exercise_id_exercises_id_fkey";
