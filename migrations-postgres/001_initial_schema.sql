-- People Scheduler - PostgreSQL Schema
-- Compatible with Neon PostgreSQL 17

-- Jobs table (Monaguillos, Lectores)
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    people_required INTEGER NOT NULL DEFAULT 4,
    color VARCHAR(50) DEFAULT '#3B82F6',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- People table (~80 volunteers)
CREATE TABLE IF NOT EXISTS people (
    id VARCHAR(255) PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(100),
    preferred_frequency VARCHAR(50) DEFAULT 'bimonthly',
    max_consecutive_weeks INTEGER DEFAULT 2,
    preference_level INTEGER DEFAULT 5,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which jobs each person can do
CREATE TABLE IF NOT EXISTS person_jobs (
    id VARCHAR(255) PRIMARY KEY,
    person_id VARCHAR(255) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    proficiency_level INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(person_id, job_id)
);

-- Sibling/family groups for pairing rules
CREATE TABLE IF NOT EXISTS sibling_groups (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pairing_rule VARCHAR(50) NOT NULL DEFAULT 'TOGETHER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members of sibling groups
CREATE TABLE IF NOT EXISTS sibling_group_members (
    id VARCHAR(255) PRIMARY KEY,
    sibling_group_id VARCHAR(255) NOT NULL REFERENCES sibling_groups(id) ON DELETE CASCADE,
    person_id VARCHAR(255) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sibling_group_id, person_id)
);

-- Unavailability periods
CREATE TABLE IF NOT EXISTS unavailability (
    id VARCHAR(255) PRIMARY KEY,
    person_id VARCHAR(255) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly schedule batches
CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    UNIQUE(year, month)
);

-- Service dates within a schedule (Sundays)
CREATE TABLE IF NOT EXISTS service_dates (
    id VARCHAR(255) PRIMARY KEY,
    schedule_id VARCHAR(255) NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    service_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(schedule_id, service_date)
);

-- Job positions table (sub-positions for each job)
CREATE TABLE IF NOT EXISTS job_positions (
    id VARCHAR(255) PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    position_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, position_number)
);

-- Assignments of people to jobs on specific dates
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR(255) PRIMARY KEY,
    service_date_id VARCHAR(255) NOT NULL REFERENCES service_dates(id) ON DELETE CASCADE,
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    person_id VARCHAR(255) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 1,
    position_name VARCHAR(255),
    manual_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_date_id, job_id, person_id)
);

-- Historical tracking for fairness calculations
CREATE TABLE IF NOT EXISTS assignment_history (
    id VARCHAR(255) PRIMARY KEY,
    person_id VARCHAR(255) NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    service_date DATE NOT NULL,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    position INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default jobs
INSERT INTO jobs (id, name, description, people_required, color) VALUES
    ('monaguillos', 'Monaguillos', 'Altar servers', 4, '#3B82F6'),
    ('lectores', 'Lectores', 'Scripture readers', 4, '#10B981')
ON CONFLICT (id) DO NOTHING;

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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_jobs_person ON person_jobs(person_id);
CREATE INDEX IF NOT EXISTS idx_person_jobs_job ON person_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_unavailability_person ON unavailability(person_id);
CREATE INDEX IF NOT EXISTS idx_unavailability_dates ON unavailability(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_assignments_service_date ON assignments(service_date_id);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_person ON assignment_history(person_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_year ON assignment_history(year);
CREATE INDEX IF NOT EXISTS idx_job_positions_job ON job_positions(job_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_position ON assignment_history(person_id, job_id, position);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_people_updated_at ON people;
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sibling_groups_updated_at ON sibling_groups;
CREATE TRIGGER update_sibling_groups_updated_at BEFORE UPDATE ON sibling_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
