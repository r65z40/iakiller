CREATE TABLE "promo_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"stripe_coupon_id" text,
	"stripe_promotion_code_id" text,
	"kind" text NOT NULL,
	"percent_off" integer,
	"amount_off_cents" integer,
	"currency" text DEFAULT 'eur' NOT NULL,
	"duration" text DEFAULT 'once' NOT NULL,
	"duration_months" integer,
	"max_redemptions" integer,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"times_redeemed" integer DEFAULT 0 NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;