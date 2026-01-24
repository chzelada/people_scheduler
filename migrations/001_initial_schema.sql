-- Jobs table (Monaguillos, Lectores)
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR,
    people_required INTEGER NOT NULL DEFAULT 4,
    color VARCHAR DEFAULT '#3B82F6',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- People table (~80 volunteers)
CREATE TABLE IF NOT EXISTS people (
    id VARCHAR PRIMARY KEY,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    preferred_frequency VARCHAR DEFAULT 'bimonthly', -- weekly, bimonthly, monthly
    max_consecutive_weeks INTEGER DEFAULT 2,
    preference_level INTEGER DEFAULT 5, -- 1-10, higher = more preferred
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Which jobs each person can do
CREATE TABLE IF NOT EXISTS person_jobs (
    id VARCHAR PRIMARY KEY,
    person_id VARCHAR NOT NULL,
    job_id VARCHAR NOT NULL,
    proficiency_level INTEGER DEFAULT 5, -- 1-10
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id, job_id)
);

-- Sibling/family groups for pairing rules
CREATE TABLE IF NOT EXISTS sibling_groups (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    pairing_rule VARCHAR NOT NULL DEFAULT 'TOGETHER', -- TOGETHER or SEPARATE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Members of sibling groups
CREATE TABLE IF NOT EXISTS sibling_group_members (
    id VARCHAR PRIMARY KEY,
    sibling_group_id VARCHAR NOT NULL,
    person_id VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sibling_group_id, person_id)
);

-- Unavailability periods
CREATE TABLE IF NOT EXISTS unavailability (
    id VARCHAR PRIMARY KEY,
    person_id VARCHAR NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR,
    recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly schedule batches
CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'DRAFT', -- DRAFT, PUBLISHED, ARCHIVED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    UNIQUE(year, month)
);

-- Service dates within a schedule (Sundays)
CREATE TABLE IF NOT EXISTS service_dates (
    id VARCHAR PRIMARY KEY,
    schedule_id VARCHAR NOT NULL,
    service_date DATE NOT NULL,
    notes VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_id, service_date)
);

-- Assignments of people to jobs on specific dates
CREATE TABLE IF NOT EXISTS assignments (
    id VARCHAR PRIMARY KEY,
    service_date_id VARCHAR NOT NULL,
    job_id VARCHAR NOT NULL,
    person_id VARCHAR NOT NULL,
    position INTEGER DEFAULT 1, -- For ordering within a job
    manual_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_date_id, job_id, person_id)
);

-- Historical tracking for fairness calculations
CREATE TABLE IF NOT EXISTS assignment_history (
    id VARCHAR PRIMARY KEY,
    person_id VARCHAR NOT NULL,
    job_id VARCHAR NOT NULL,
    service_date DATE NOT NULL,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default jobs
INSERT INTO jobs (id, name, description, people_required, color) VALUES
    ('monaguillos', 'Monaguillos', 'Altar servers', 4, '#3B82F6'),
    ('lectores', 'Lectores', 'Scripture readers', 4, '#10B981')
ON CONFLICT (id) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_person_jobs_person ON person_jobs(person_id);
CREATE INDEX IF NOT EXISTS idx_person_jobs_job ON person_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_unavailability_person ON unavailability(person_id);
CREATE INDEX IF NOT EXISTS idx_unavailability_dates ON unavailability(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_assignments_service_date ON assignments(service_date_id);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_person ON assignment_history(person_id);
CREATE INDEX IF NOT EXISTS idx_assignment_history_year ON assignment_history(year);
