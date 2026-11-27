ALTER TABLE "achievements" ADD COLUMN "tier" varchar(10) DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "milestone_group" varchar(80);--> statement-breakpoint
ALTER TABLE "achievements" ADD COLUMN "badge_design" jsonb;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_tier_valid" CHECK ("tier" in ('starter','growing','advanced','mastery'));--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_milestone_group_nonblank" CHECK ("milestone_group" is null or length(btrim("milestone_group")) > 0);--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_badge_design_valid" CHECK ("badge_design" is null or (
        jsonb_typeof("badge_design") = 'object' and "badge_design"->'version' = '1'::jsonb
        and "badge_design" ?& array['version','border','pattern','decoration','finish']
        and ("badge_design" - array['version','border','pattern','decoration','finish']) = '{}'::jsonb
        and "badge_design"->>'border' in ('single','double','dotted','laurel')
        and "badge_design"->>'pattern' in ('solid','rays','stars','diamonds')
        and "badge_design"->>'decoration' in ('none','ribbon','wings','stars')
        and "badge_design"->>'finish' in ('classic','soft','deep')) is true);
