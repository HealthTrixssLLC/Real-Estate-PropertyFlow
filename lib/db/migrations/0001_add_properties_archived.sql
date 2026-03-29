-- Migration: Add archived column to properties table
-- Applied: 2026-03-29
-- Description: Adds a soft-delete `archived` boolean column to the properties table.
-- Existing rows default to false (not archived).

ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "archived" boolean NOT NULL DEFAULT false;
