ALTER TABLE "profiles" ADD COLUMN "avatar" varchar(24) DEFAULT 'wave' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "featured_achievements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_valid" CHECK ("avatar" in ('wave','love','owl','fox','star','rocket','sprout','compass'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_featured_achievements_valid" CHECK (jsonb_typeof("featured_achievements") = 'array' and jsonb_array_length("featured_achievements") <= 3);
