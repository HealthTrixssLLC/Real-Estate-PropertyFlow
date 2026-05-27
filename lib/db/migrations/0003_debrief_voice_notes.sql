-- Migration: Voice debrief, fit scoring & buyer preference profile

-- Create enum for debrief processing status
DO $$ BEGIN
  CREATE TYPE debrief_processing_status AS ENUM ('pending', 'transcribing', 'scoring', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create debrief_voice_notes table
CREATE TABLE IF NOT EXISTS debrief_voice_notes (
  id VARCHAR(36) PRIMARY KEY,
  tour_stop_id VARCHAR(36) NOT NULL REFERENCES tour_stops(id) ON DELETE CASCADE,
  buyer_id VARCHAR(36) REFERENCES buyers(id) ON DELETE SET NULL,
  file_url TEXT,
  duration_seconds INTEGER,
  transcript TEXT,
  ai_summary TEXT,
  fit_score INTEGER,
  fit_score_positives TEXT[],
  fit_score_negatives TEXT[],
  fit_score_verdict TEXT,
  processing_status debrief_processing_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add predicted_fit_score to tour_stops
ALTER TABLE tour_stops ADD COLUMN IF NOT EXISTS predicted_fit_score INTEGER;

-- Add preference_profile columns to buyers
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS preference_profile TEXT;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS preference_profile_updated_at TIMESTAMPTZ;
