ALTER TABLE "app"."brands" ALTER COLUMN "banned_words" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "display_name" text;