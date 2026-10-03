CREATE TABLE "backup_run" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"created_by_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"manifest_key" text,
	"encrypted" boolean DEFAULT false NOT NULL,
	"db_bytes" bigint DEFAULT 0 NOT NULL,
	"written_bytes" bigint DEFAULT 0 NOT NULL,
	"media_count" integer DEFAULT 0 NOT NULL,
	"media_copied" integer DEFAULT 0 NOT NULL,
	"missing_files" integer DEFAULT 0 NOT NULL,
	"error" text,
	"verified_at" timestamp with time zone,
	"verify_status" text,
	"verify_detail" text,
	"restore_tested_at" timestamp with time zone,
	"restore_test_status" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "backup_run" ADD CONSTRAINT "backup_run_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "backup_run_started_idx" ON "backup_run" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "backup_run_single_running_uq" ON "backup_run" USING btree ("status") WHERE status = 'running';