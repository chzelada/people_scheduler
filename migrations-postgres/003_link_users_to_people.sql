-- Link users table to people table for servidor login
ALTER TABLE users ADD COLUMN IF NOT EXISTS person_id VARCHAR REFERENCES people(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_person_id ON users(person_id);
