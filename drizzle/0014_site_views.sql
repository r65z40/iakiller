CREATE TABLE "site_view" (
	"site_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "site_view_site_id_day_pk" PRIMARY KEY("site_id","day")
);
--> statement-breakpoint
ALTER TABLE "site_view" ADD CONSTRAINT "site_view_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_view" ADD CONSTRAINT "site_view_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_view_org_idx" ON "site_view" USING btree ("organization_id");