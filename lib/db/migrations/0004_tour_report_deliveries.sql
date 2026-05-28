DO $$ BEGIN
  CREATE TYPE "report_delivery_channel" AS ENUM ('email', 'sms');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "report_delivery_status" AS ENUM ('pending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "tour_report_deliveries" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "tour_id" varchar(36) NOT NULL REFERENCES "tours"("id") ON DELETE CASCADE,
  "channel" "report_delivery_channel" NOT NULL,
  "recipient" varchar(255) NOT NULL,
  "status" "report_delivery_status" NOT NULL DEFAULT 'pending',
  "provider" varchar(100),
  "error_message" text,
  "public_token_jti" varchar(64),
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tour_report_deliveries_tour_id_idx" ON "tour_report_deliveries" ("tour_id");
