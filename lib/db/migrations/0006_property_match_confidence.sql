ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "match_confidence" varchar(10);
