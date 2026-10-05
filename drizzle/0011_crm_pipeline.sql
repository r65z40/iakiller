CREATE TABLE "lead_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_task" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "stage" text DEFAULT 'nouveau' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "source" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "source_detail" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "assigned_to_id" text;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task" ADD CONSTRAINT "lead_task_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task" ADD CONSTRAINT "lead_task_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task" ADD CONSTRAINT "lead_task_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_activity_lead_idx" ON "lead_activity" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_task_lead_idx" ON "lead_task" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_task_org_due_idx" ON "lead_task" USING btree ("organization_id","due_at");--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_org_stage_idx" ON "lead" USING btree ("organization_id","stage");--> statement-breakpoint
UPDATE "lead" SET "stage" = CASE "status" WHEN 'contacted' THEN 'contacte' WHEN 'done' THEN 'gagne' ELSE 'nouveau' END;
