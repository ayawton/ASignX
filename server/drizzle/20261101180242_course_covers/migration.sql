ALTER TABLE "courses" ADD COLUMN "cover_text" varchar(32) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "cover_style" varchar(12) DEFAULT 'plain' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "cover_tone" varchar(12) DEFAULT 'sky' NOT NULL;