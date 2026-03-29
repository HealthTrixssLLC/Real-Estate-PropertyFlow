-- Migration: Add local auth columns to users table (Task #8 - Local Credentials)
-- This migration was applied manually because Task #8 ran in an isolated environment
-- and the raw SQL was not included in the post-merge script.

-- Add 'admin' role to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- Add local authentication columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR,
  ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
