-- Migration 008: Add profile photo column
ALTER TABLE people ADD COLUMN IF NOT EXISTS photo_url TEXT;
