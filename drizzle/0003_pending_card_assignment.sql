CREATE TABLE "pending_card_assignment" (
	"card_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_card_assignment_card_id_email_pk" PRIMARY KEY("card_id","email")
);
--> statement-breakpoint
ALTER TABLE "pending_card_assignment" ADD CONSTRAINT "pending_card_assignment_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_card_assignment" ADD CONSTRAINT "pending_card_assignment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_assignment_org_email_idx" ON "pending_card_assignment" USING btree ("organization_id","email");