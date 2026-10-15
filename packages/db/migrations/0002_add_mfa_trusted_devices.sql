CREATE TABLE IF NOT EXISTS "app"."mfa_trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hashed_token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_digest" text,
	"user_agent_digest" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mfa_trusted_devices_hashed_token_unique" UNIQUE("hashed_token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."mfa_trusted_devices" ADD CONSTRAINT "mfa_trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
