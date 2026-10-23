-- Refuse to discard legacy data, including when only one practice table remains.
DO $$
DECLARE
    legacy_table text;
    populated boolean;
BEGIN
    FOREACH legacy_table IN ARRAY ARRAY['departments', 'subjects'] LOOP
        IF to_regclass('public.' || legacy_table) IS NOT NULL THEN
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', legacy_table) INTO populated;
            IF populated THEN
                RAISE EXCEPTION 'Legacy departments/subjects contain data. Export and clear them before replacing the practice schema.';
            END IF;
        END IF;
    END LOOP;
END $$;
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(50) NOT NULL UNIQUE,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"metric" varchar(25) NOT NULL,
	"threshold" integer NOT NULL,
	CONSTRAINT "achievements_code_nonblank" CHECK (length(btrim("code")) > 0),
	CONSTRAINT "achievements_name_nonblank" CHECK (length(btrim("name")) > 0),
	CONSTRAINT "achievements_description_nonblank" CHECK (length(btrim("description")) > 0),
	CONSTRAINT "achievements_metric_valid" CHECK ("metric" in ('completed_lessons', 'successful_practices', 'total_xp', 'streak_days')),
	CONSTRAINT "achievements_threshold_positive" CHECK ("threshold" > 0)
);
--> statement-breakpoint
ALTER TABLE "achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" varchar(150) NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_title_nonblank" CHECK (length(btrim("title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"selected_option_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercise_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"exercise_id" uuid NOT NULL,
	"option_text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "exercise_options_order_unique" UNIQUE("exercise_id","sort_order"),
	CONSTRAINT "exercise_options_exercise_id_unique" UNIQUE("exercise_id","id"),
	CONSTRAINT "exercise_options_text_nonblank" CHECK (length(btrim("option_text")) > 0),
	CONSTRAINT "exercise_options_sort_order_positive" CHECK ("sort_order" > 0)
);
--> statement-breakpoint
ALTER TABLE "exercise_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lesson_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"sign_id" uuid,
	"sort_order" integer NOT NULL,
	CONSTRAINT "exercises_lesson_order_unique" UNIQUE("lesson_id","sort_order"),
	CONSTRAINT "exercises_prompt_nonblank" CHECK (length(btrim("prompt")) > 0),
	CONSTRAINT "exercises_sort_order_positive" CHECK ("sort_order" > 0)
);
--> statement-breakpoint
ALTER TABLE "exercises" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"enrollment_id" uuid,
	"lesson_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "lesson_progress_pkey" PRIMARY KEY("enrollment_id","lesson_id"),
	CONSTRAINT "lesson_progress_xp_nonnegative" CHECK ("xp_earned" >= 0),
	CONSTRAINT "lesson_progress_completion_valid" CHECK (("completed_at" is null and "xp_earned" = 0) or ("completed_at" is not null and "completed_at" >= "started_at"))
);
--> statement-breakpoint
ALTER TABLE "lesson_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lesson_signs" (
	"lesson_id" uuid,
	"sign_id" uuid,
	"sort_order" integer NOT NULL,
	CONSTRAINT "lesson_signs_pkey" PRIMARY KEY("lesson_id","sign_id"),
	CONSTRAINT "lesson_signs_order_unique" UNIQUE("lesson_id","sort_order"),
	CONSTRAINT "lesson_signs_sort_order_positive" CHECK ("sort_order" > 0)
);
--> statement-breakpoint
ALTER TABLE "lesson_signs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"course_id" uuid NOT NULL,
	"title" varchar(150) NOT NULL,
	"content" text,
	"sort_order" integer NOT NULL,
	"xp_reward" integer DEFAULT 10 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	CONSTRAINT "lessons_course_order_unique" UNIQUE("course_id","sort_order"),
	CONSTRAINT "lessons_title_nonblank" CHECK (length(btrim("title")) > 0),
	CONSTRAINT "lessons_sort_order_positive" CHECK ("sort_order" > 0),
	CONSTRAINT "lessons_xp_nonnegative" CHECK ("xp_reward" >= 0)
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "model_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" varchar(50) NOT NULL UNIQUE,
	"artifact_path" text NOT NULL,
	"confidence_threshold" numeric(6,5) DEFAULT '0.80000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_versions_version_nonblank" CHECK (length(btrim("version")) > 0),
	CONSTRAINT "model_versions_artifact_nonblank" CHECK (length(btrim("artifact_path")) > 0),
	CONSTRAINT "model_versions_threshold_range" CHECK ("confidence_threshold" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "model_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "practice_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"lesson_id" uuid,
	"target_sign_id" uuid NOT NULL,
	"predicted_sign_id" uuid,
	"model_version_id" uuid NOT NULL,
	"confidence" numeric(6,5) NOT NULL,
	"is_correct" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_attempts_confidence_range" CHECK ("confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "practice_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY,
	"display_name" varchar(100) NOT NULL,
	"role" varchar(10) DEFAULT 'learner' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_display_name_nonblank" CHECK (length(btrim("display_name")) > 0),
	CONSTRAINT "profiles_role_valid" CHECK ("role" in ('learner', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recognition_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"sign_id" uuid,
	"model_version_id" uuid NOT NULL,
	"sequence_no" integer NOT NULL,
	"confidence" numeric(6,5) NOT NULL,
	"recognized_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recognition_results_session_sequence_unique" UNIQUE("session_id","sequence_no"),
	CONSTRAINT "recognition_results_sequence_positive" CHECK ("sequence_no" > 0),
	CONSTRAINT "recognition_results_confidence_range" CHECK ("confidence" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "recognition_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recognition_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"final_text" text,
	CONSTRAINT "recognition_sessions_end_valid" CHECK ("ended_at" is null or "ended_at" >= "started_at"),
	CONSTRAINT "recognition_sessions_text_valid" CHECK ("final_text" is null or "ended_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "recognition_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"gloss" varchar(100) NOT NULL UNIQUE,
	"meaning" text NOT NULL,
	"category" varchar(60),
	"instructions" text,
	"demo_path" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signs_gloss_nonblank" CHECK (length(btrim("gloss")) > 0),
	CONSTRAINT "signs_meaning_nonblank" CHECK (length(btrim("meaning")) > 0)
);
--> statement-breakpoint
ALTER TABLE "signs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid,
	"achievement_id" uuid,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_pkey" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "user_achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "subjects" DROP CONSTRAINT IF EXISTS "subjects_departmentId_departments_id_fkey";--> statement-breakpoint
DROP TABLE IF EXISTS "departments";--> statement-breakpoint
DROP TABLE IF EXISTS "subjects";--> statement-breakpoint
CREATE INDEX "enrollments_course_idx" ON "enrollments" ("course_id");--> statement-breakpoint
CREATE INDEX "exercise_attempts_enrollment_idx" ON "exercise_attempts" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "exercise_attempts_exercise_option_idx" ON "exercise_attempts" ("exercise_id","selected_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_options_one_correct_idx" ON "exercise_options" ("exercise_id") WHERE "is_correct";--> statement-breakpoint
CREATE INDEX "exercises_sign_idx" ON "exercises" ("sign_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_lesson_idx" ON "lesson_progress" ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_signs_sign_idx" ON "lesson_signs" ("sign_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_user_time_idx" ON "practice_attempts" ("user_id","attempted_at");--> statement-breakpoint
CREATE INDEX "practice_attempts_lesson_idx" ON "practice_attempts" ("lesson_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_target_idx" ON "practice_attempts" ("target_sign_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_prediction_idx" ON "practice_attempts" ("predicted_sign_id");--> statement-breakpoint
CREATE INDEX "practice_attempts_model_idx" ON "practice_attempts" ("model_version_id");--> statement-breakpoint
CREATE INDEX "recognition_results_sign_idx" ON "recognition_results" ("sign_id");--> statement-breakpoint
CREATE INDEX "recognition_results_model_idx" ON "recognition_results" ("model_version_id");--> statement-breakpoint
CREATE INDEX "recognition_sessions_user_time_idx" ON "recognition_sessions" ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "user_achievements_achievement_idx" ON "user_achievements" ("achievement_id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_id_exercises_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_selected_option_fk" FOREIGN KEY ("exercise_id","selected_option_id") REFERENCES "exercise_options"("exercise_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "exercise_options" ADD CONSTRAINT "exercise_options_exercise_id_exercises_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_sign_id_signs_id_fkey" FOREIGN KEY ("sign_id") REFERENCES "signs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_signs" ADD CONSTRAINT "lesson_signs_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lesson_signs" ADD CONSTRAINT "lesson_signs_sign_id_signs_id_fkey" FOREIGN KEY ("sign_id") REFERENCES "signs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_target_sign_id_signs_id_fkey" FOREIGN KEY ("target_sign_id") REFERENCES "signs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_predicted_sign_id_signs_id_fkey" FOREIGN KEY ("predicted_sign_id") REFERENCES "signs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "practice_attempts" ADD CONSTRAINT "practice_attempts_model_version_id_model_versions_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "model_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recognition_results" ADD CONSTRAINT "recognition_results_session_id_recognition_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "recognition_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recognition_results" ADD CONSTRAINT "recognition_results_sign_id_signs_id_fkey" FOREIGN KEY ("sign_id") REFERENCES "signs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "recognition_results" ADD CONSTRAINT "recognition_results_model_version_id_model_versions_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "model_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "recognition_sessions" ADD CONSTRAINT "recognition_sessions_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE POLICY "achievements_read" ON "achievements" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "courses_read_published" ON "courses" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("courses"."is_published");--> statement-breakpoint
CREATE POLICY "enrollments_read_own" ON "enrollments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("enrollments"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "exercise_attempts_read_own" ON "exercise_attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.enrollments e where e.id = "exercise_attempts"."enrollment_id" and e.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "exercises_read_published" ON "exercises" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id where l.id = "exercises"."lesson_id" and l.is_published and c.is_published));--> statement-breakpoint
CREATE POLICY "lesson_progress_read_own" ON "lesson_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.enrollments e where e.id = "lesson_progress"."enrollment_id" and e.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "lesson_signs_read_published" ON "lesson_signs" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (exists (select 1 from public.lessons l join public.courses c on c.id = l.course_id where l.id = "lesson_signs"."lesson_id" and l.is_published and c.is_published) and exists (select 1 from public.signs s where s.id = "lesson_signs"."sign_id" and s.is_published));--> statement-breakpoint
CREATE POLICY "lessons_read_published" ON "lessons" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("lessons"."is_published" and exists (select 1 from public.courses c where c.id = "lessons"."course_id" and c.is_published));--> statement-breakpoint
CREATE POLICY "practice_attempts_read_own" ON "practice_attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("practice_attempts"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_read_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid())) WITH CHECK ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "recognition_results_read_own" ON "recognition_results" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.recognition_sessions s where s.id = "recognition_results"."session_id" and s.user_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "recognition_sessions_read_own" ON "recognition_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("recognition_sessions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "signs_read_published" ON "signs" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("signs"."is_published");--> statement-breakpoint
CREATE POLICY "user_achievements_read_own" ON "user_achievements" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_achievements"."user_id" = (select auth.uid()));

