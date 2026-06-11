ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "listing_status" varchar(20),
  ADD COLUMN IF NOT EXISTS "listing_url" text,
  ADD COLUMN IF NOT EXISTS "listing_date" varchar(20),
  ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp with time zone;
