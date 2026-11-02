CREATE TABLE "heart_practice_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"questions" jsonb NOT NULL,
	"submissions" jsonb DEFAULT '[]' NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "heart_practice_correct_range" CHECK ("correct_count" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "heart_practice_rounds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "learner_hearts" (
	"user_id" uuid PRIMARY KEY,
	"hearts" integer DEFAULT 3 NOT NULL,
	"regenerated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_hearts_range" CHECK ("hearts" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "learner_hearts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_question_rewards" (
	"enrollment_id" uuid,
	"exercise_id" uuid,
	"xp_earned" integer NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_question_rewards_pkey" PRIMARY KEY("enrollment_id","exercise_id"),
	CONSTRAINT "lesson_question_reward_nonnegative" CHECK ("xp_earned">=0)
);
--> statement-breakpoint
ALTER TABLE "lesson_question_rewards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_run_questions" (
	"run_id" uuid,
	"exercise_id" uuid,
	"xp_value" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"attempt_id" uuid,
	CONSTRAINT "lesson_run_questions_pkey" PRIMARY KEY("run_id","exercise_id"),
	CONSTRAINT "lesson_run_question_order" UNIQUE("run_id","sort_order"),
	CONSTRAINT "lesson_run_question_xp_nonnegative" CHECK ("xp_value">=0)
);
--> statement-breakpoint
ALTER TABLE "lesson_run_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"replay" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"perfect" boolean DEFAULT false NOT NULL,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lesson_runs_xp_nonnegative" CHECK ("xp_earned">=0)
);
--> statement-breakpoint
ALTER TABLE "lesson_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD COLUMN "perfected_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "heart_practice_one_active" ON "heart_practice_rounds" ("user_id") WHERE "completed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_runs_one_active" ON "lesson_runs" ("enrollment_id","lesson_id") WHERE "completed_at" is null;--> statement-breakpoint
ALTER TABLE "heart_practice_rounds" ADD CONSTRAINT "heart_practice_rounds_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "learner_hearts" ADD CONSTRAINT "learner_hearts_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_question_rewards" ADD CONSTRAINT "lesson_question_rewards_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_question_rewards" ADD CONSTRAINT "lesson_question_rewards_exercise_id_exercises_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_run_questions" ADD CONSTRAINT "lesson_run_questions_run_id_lesson_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "lesson_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_run_questions" ADD CONSTRAINT "lesson_run_questions_exercise_id_exercises_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_run_questions" ADD CONSTRAINT "lesson_run_questions_attempt_id_exercise_attempts_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exercise_attempts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_runs" ADD CONSTRAINT "lesson_runs_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_runs" ADD CONSTRAINT "lesson_runs_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE POLICY "learner_hearts_read_own" ON "learner_hearts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("learner_hearts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "lesson_runs_read_own" ON "lesson_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.enrollments e where e.id = "lesson_runs"."enrollment_id" and e.user_id = (select auth.uid())));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION asignx_private.validate_progress() RETURNS trigger
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
    IF NEW.completed_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.lesson_runs r WHERE r.enrollment_id=NEW.enrollment_id AND r.lesson_id=NEW.lesson_id AND r.completed_at IS NOT NULL
    ) THEN
        NEW.xp_earned := 0;
        RETURN NEW;
    END IF;
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

--> statement-breakpoint
UPDATE public.lesson_progress SET perfected_at=completed_at WHERE completed_at IS NOT NULL;

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
        WHEN 'total_xp' THEN SELECT coalesce((select sum(p.xp_earned) from public.lesson_progress p join public.enrollments e on e.id=p.enrollment_id where e.user_id=NEW.user_id),0)+coalesce((select sum(r.xp_earned) from public.lesson_runs r join public.enrollments e on e.id=r.enrollment_id where e.user_id=NEW.user_id and r.completed_at is not null),0) INTO actual;
        WHEN 'successful_practices' THEN SELECT count(*) INTO actual FROM public.practice_attempts WHERE user_id = NEW.user_id AND is_correct;
        WHEN 'streak_days' THEN actual := asignx_private.current_streak(NEW.user_id);
    END CASE;
    IF actual < target THEN RAISE EXCEPTION 'Achievement threshold has not been met' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END $$;
