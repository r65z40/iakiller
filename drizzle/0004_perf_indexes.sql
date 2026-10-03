CREATE INDEX "card_version_media_ids_gin" ON "card_version" USING gin ("media_ids" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "lead_card_time_idx" ON "lead" USING btree ("card_id","created_at");--> statement-breakpoint
CREATE INDEX "organization_created_by_idx" ON "organization" USING btree ("created_by_id");