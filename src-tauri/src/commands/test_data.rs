use uuid::Uuid;
use std::collections::HashMap;
use chrono::Datelike;
use crate::db::with_db;
use crate::models::GenerateScheduleRequest;
use crate::scheduler::ScheduleGenerator;

#[tauri::command]
pub fn import_test_data(csv_path: String) -> Result<String, String> {
    // Read CSV file
    let csv_content = std::fs::read_to_string(&csv_path)
        .map_err(|e| format!("Failed to read CSV: {}", e))?;

    // First, ensure jobs exist
    let job_ids = ensure_jobs_exist()?;

    // Parse CSV and create people
    let mut created_count = 0;
    let lines: Vec<&str> = csv_content.lines().collect();

    // Skip header
    for line in lines.iter().skip(1) {
        if line.trim().is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 5 {
            continue;
        }

        let first_name = parts[0].trim();
        let last_name = parts[1].trim();
        let email = parts[2].trim();
        let phone = parts[3].trim();
        let services = parts[4].trim();

        // Parse services
        let mut person_job_ids: Vec<String> = Vec::new();
        for service in services.split(';') {
            let service = service.trim();
            if let Some(job_id) = job_ids.get(service) {
                person_job_ids.push(job_id.clone());
            }
        }

        // Create person
        let person_id = Uuid::new_v4().to_string();
        with_db(|conn| {
            conn.execute(
                "INSERT INTO people (id, first_name, last_name, email, phone, preferred_frequency, max_consecutive_weeks, preference_level, active)
                 VALUES (?, ?, ?, ?, ?, 'bimonthly', 2, 5, TRUE)",
                duckdb::params![person_id, first_name, last_name, email, phone],
            )?;

            // Add job associations
            for job_id in &person_job_ids {
                let pj_id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO person_jobs (id, person_id, job_id) VALUES (?, ?, ?)",
                    duckdb::params![pj_id, person_id, job_id],
                )?;
            }

            Ok(())
        })?;

        created_count += 1;
    }

    Ok(format!("Imported {} people", created_count))
}

#[tauri::command]
pub fn generate_year_schedules(year: i32) -> Result<String, String> {
    let generator = ScheduleGenerator::new();
    let mut generated_count = 0;

    for month in 1..=12 {
        // Check if schedule already exists
        let exists = with_db(|conn| {
            let mut stmt = conn.prepare(
                "SELECT COUNT(*) FROM schedules WHERE year = ? AND month = ?"
            )?;
            let count: i64 = stmt.query_row(duckdb::params![year, month], |row| row.get(0))?;
            Ok(count > 0)
        })?;

        if exists {
            continue;
        }

        // Generate schedule
        let request = GenerateScheduleRequest {
            year,
            month,
            name: None,
        };

        let preview = generator.generate(request)?;

        // Save the schedule
        let schedule = preview.schedule;
        with_db(|conn| {
            // Insert schedule
            conn.execute(
                "INSERT INTO schedules (id, name, year, month, status) VALUES (?, ?, ?, ?, 'PUBLISHED')",
                duckdb::params![schedule.id, schedule.name, schedule.year, schedule.month],
            )?;

            // Insert service dates and assignments
            for service_date in &schedule.service_dates {
                conn.execute(
                    "INSERT INTO service_dates (id, schedule_id, service_date) VALUES (?, ?, ?)",
                    duckdb::params![service_date.id, schedule.id, service_date.service_date.to_string()],
                )?;

                for assignment in &service_date.assignments {
                    conn.execute(
                        "INSERT INTO assignments (id, service_date_id, job_id, person_id, position, manual_override)
                         VALUES (?, ?, ?, ?, ?, ?)",
                        duckdb::params![
                            assignment.id,
                            assignment.service_date_id,
                            assignment.job_id,
                            assignment.person_id,
                            assignment.position,
                            assignment.manual_override
                        ],
                    )?;

                    // Also add to assignment_history for future schedule generation
                    let history_id = Uuid::new_v4().to_string();
                    let week_number = service_date.service_date.iso_week().week() as i32;
                    conn.execute(
                        "INSERT INTO assignment_history (id, person_id, job_id, service_date, year, week_number, position)
                         VALUES (?, ?, ?, ?, ?, ?, ?)",
                        duckdb::params![
                            history_id,
                            assignment.person_id,
                            assignment.job_id,
                            service_date.service_date.to_string(),
                            year,
                            week_number,
                            assignment.position
                        ],
                    )?;
                }
            }

            Ok(())
        })?;

        generated_count += 1;
    }

    Ok(format!("Generated {} schedules for {}", generated_count, year))
}

fn ensure_jobs_exist() -> Result<HashMap<String, String>, String> {
    let mut job_ids: HashMap<String, String> = HashMap::new();

    // Check if Monaguillos exists
    let monaguillos_id = with_db(|conn| {
        let mut stmt = conn.prepare("SELECT id FROM jobs WHERE name = 'Monaguillos'")?;
        let result: Result<String, _> = stmt.query_row([], |row| row.get(0));
        match result {
            Ok(id) => Ok(Some(id)),
            Err(_) => Ok(None),
        }
    })?;

    let monaguillos_id = match monaguillos_id {
        Some(id) => id,
        None => {
            let id = Uuid::new_v4().to_string();
            with_db(|conn| {
                conn.execute(
                    "INSERT INTO jobs (id, name, description, people_required, color, active)
                     VALUES (?, 'Monaguillos', 'Altar servers', 4, '#3B82F6', TRUE)",
                    duckdb::params![id],
                )?;
                Ok(())
            })?;
            // Add positions for Monaguillos
            for i in 1..=4 {
                let pos_id = Uuid::new_v4().to_string();
                with_db(|conn| {
                    conn.execute(
                        "INSERT INTO job_positions (id, job_id, position_number, name)
                         VALUES (?, ?, ?, ?)",
                        duckdb::params![pos_id, id, i, format!("Monaguillo {}", i)],
                    )?;
                    Ok(())
                })?;
            }
            id
        }
    };
    job_ids.insert("Monaguillos".to_string(), monaguillos_id);

    // Check if Lectores exists
    let lectores_id = with_db(|conn| {
        let mut stmt = conn.prepare("SELECT id FROM jobs WHERE name = 'Lectores'")?;
        let result: Result<String, _> = stmt.query_row([], |row| row.get(0));
        match result {
            Ok(id) => Ok(Some(id)),
            Err(_) => Ok(None),
        }
    })?;

    let lectores_id = match lectores_id {
        Some(id) => id,
        None => {
            let id = Uuid::new_v4().to_string();
            with_db(|conn| {
                conn.execute(
                    "INSERT INTO jobs (id, name, description, people_required, color, active)
                     VALUES (?, 'Lectores', 'Readers', 4, '#10B981', TRUE)",
                    duckdb::params![id],
                )?;
                Ok(())
            })?;
            // Add positions for Lectores
            let lector_positions = ["Monitor", "Primera Lectura", "Salmo", "Segunda Lectura"];
            for (i, name) in lector_positions.iter().enumerate() {
                let pos_id = Uuid::new_v4().to_string();
                with_db(|conn| {
                    conn.execute(
                        "INSERT INTO job_positions (id, job_id, position_number, name)
                         VALUES (?, ?, ?, ?)",
                        duckdb::params![pos_id, id, (i + 1) as i32, name],
                    )?;
                    Ok(())
                })?;
            }
            id
        }
    };
    job_ids.insert("Lectores".to_string(), lectores_id);

    Ok(job_ids)
}
