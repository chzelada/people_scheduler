-- Job positions table (sub-positions for each job)
CREATE TABLE IF NOT EXISTS job_positions (
    id VARCHAR PRIMARY KEY,
    job_id VARCHAR NOT NULL,
    position_number INTEGER NOT NULL, -- 1, 2, 3, 4
    name VARCHAR NOT NULL, -- "Monaguillo 1", "Monitor", etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, position_number)
);

-- Add position_name to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS position_name VARCHAR;

-- Add position to assignment_history for rotation tracking
ALTER TABLE assignment_history ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 1;

-- Insert positions for Monaguillos
INSERT INTO job_positions (id, job_id, position_number, name) VALUES
    ('monaguillos-1', 'monaguillos', 1, 'Monaguillo 1'),
    ('monaguillos-2', 'monaguillos', 2, 'Monaguillo 2'),
    ('monaguillos-3', 'monaguillos', 3, 'Monaguillo 3'),
    ('monaguillos-4', 'monaguillos', 4, 'Monaguillo 4')
ON CONFLICT (job_id, position_number) DO NOTHING;

-- Insert positions for Lectores
INSERT INTO job_positions (id, job_id, position_number, name) VALUES
    ('lectores-1', 'lectores', 1, 'Monitor'),
    ('lectores-2', 'lectores', 2, 'Primera Lectura'),
    ('lectores-3', 'lectores', 3, 'Salmo'),
    ('lectores-4', 'lectores', 4, 'Segunda Lectura')
ON CONFLICT (job_id, position_number) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_job_positions_job ON job_positions(job_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_position ON assignment_history(person_id, job_id, position);
