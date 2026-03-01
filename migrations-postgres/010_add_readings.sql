CREATE TABLE IF NOT EXISTS liturgical_readings (
    id VARCHAR(255) PRIMARY KEY,
    service_date_id VARCHAR(255) NOT NULL REFERENCES service_dates(id) ON DELETE CASCADE,
    reading_type VARCHAR(50) NOT NULL,
    reference TEXT NOT NULL,
    body TEXT NOT NULL,
    source_url TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_date_id, reading_type)
);
