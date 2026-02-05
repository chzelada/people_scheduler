-- Add columns to exclude people from specific job assignments
ALTER TABLE people ADD COLUMN IF NOT EXISTS exclude_monaguillos BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS exclude_lectores BOOLEAN NOT NULL DEFAULT FALSE;
