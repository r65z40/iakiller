CREATE TABLE "lead_automation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger" text NOT NULL,
	"trigger_stage" text,
	"delay_hours" integer DEFAULT 24 NOT NULL,
	"action" text NOT NULL,
	"email_subject" text,
	"email_body" text,
	"task_title" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_automation_run" (
	"automation_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_automation_run_automation_id_lead_id_pk" PRIMARY KEY("automation_id","lead_id")
);
--> statement-breakpoint
ALTER TABLE "lead_automation" ADD CONSTRAINT "lead_automation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_automation" ADD CONSTRAINT "lead_automation_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_automation_run" ADD CONSTRAINT "lead_automation_run_automation_id_lead_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."lead_automation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_automation_run" ADD CONSTRAINT "lead_automation_run_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_automation_org_idx" ON "lead_automation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lead_automation_run_lead_idx" ON "lead_automation_run" USING btree ("lead_id");