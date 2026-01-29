-- Migration: Allow person_id to be NULL for empty slots in drag-and-drop editing
-- This enables creating assignment placeholders that can be filled later

-- Make person_id nullable
ALTER TABLE assignments ALTER COLUMN person_id DROP NOT NULL;

-- Drop the old unique constraint if it exists
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_service_date_id_job_id_person_id_key;

-- Add new unique constraint on slot (service_date_id, job_id, position)
-- This allows multiple empty slots (NULL person_id) while preventing duplicate assignments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'assignments_unique_slot'
    ) THEN
        ALTER TABLE assignments ADD CONSTRAINT assignments_unique_slot
            UNIQUE(service_date_id, job_id, position);
    END IF;
END $$;
