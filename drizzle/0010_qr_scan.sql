CREATE TABLE "qr_scan" (
	"card_id" text NOT NULL,
	"slug" text DEFAULT '' NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "qr_scan_card_id_slug_day_pk" PRIMARY KEY("card_id","slug","day")
);
--> statement-breakpoint
ALTER TABLE "qr_scan" ADD CONSTRAINT "qr_scan_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;