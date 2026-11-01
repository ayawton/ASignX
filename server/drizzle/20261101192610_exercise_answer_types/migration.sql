ALTER TABLE "exercise_attempts" ADD COLUMN "response_text" text;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD COLUMN "recognition_confidence" numeric(6,5);--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD COLUMN "recognition_model" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "answer_type" varchar(16) DEFAULT 'choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_answer_type_valid" CHECK ("answer_type" in ('choice','boolean','text','recognition'));