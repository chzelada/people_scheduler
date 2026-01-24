use crate::db::with_db;
use crate::models::{
    Assignment, FairnessScore, GenerateScheduleRequest, JobAssignmentCount, Schedule,
    SchedulePreview, ScheduleStatus, ServiceDate, UpdateAssignmentRequest,
};
use crate::scheduler::ScheduleGenerator;
use chrono::{Datelike, NaiveDate};
use uuid::Uuid;

#[tauri::command]
pub fn get_all_schedules() -> Result<Vec<Schedule>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, year, month, status
             FROM schedules
             ORDER BY year DESC, month DESC"
        )?;

        let schedules: Vec<Schedule> = stmt
            .query_map([], |row| {
                Ok(Schedule {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    year: row.get(2)?,
                    month: row.get(3)?,
                    status: ScheduleStatus::from_str(&row.get::<_, String>(4)?),
                    created_at: None,
                    updated_at: None,
                    published_at: None,
                    service_dates: Vec::new(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(schedules)
    })
}

#[tauri::command]
pub fn get_schedule(id: String) -> Result<Schedule, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, year, month, status
             FROM schedules WHERE id = ?"
        )?;

        let mut schedule: Schedule = stmt.query_row([&id], |row| {
            Ok(Schedule {
                id: row.get(0)?,
                name: row.get(1)?,
                year: row.get(2)?,
                month: row.get(3)?,
                status: ScheduleStatus::from_str(&row.get::<_, String>(4)?),
                created_at: None,
                updated_at: None,
                published_at: None,
                service_dates: Vec::new(),
            })
        })?;

        // Fetch service dates
        let mut sd_stmt = conn.prepare(
            "SELECT id, schedule_id, CAST(service_date AS VARCHAR), notes
             FROM service_dates
             WHERE schedule_id = ?
             ORDER BY service_date"
        )?;

        schedule.service_dates = sd_stmt
            .query_map([&id], |row| {
                let date_str: String = row.get(2)?;
                let service_date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                    .unwrap_or(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap());
                Ok(ServiceDate {
                    id: row.get(0)?,
                    schedule_id: row.get(1)?,
                    service_date,
                    notes: row.get(3)?,
                    created_at: None,
                    assignments: Vec::new(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Fetch assignments for each service date
        for sd in &mut schedule.service_dates {
            let mut assign_stmt = conn.prepare(
                "SELECT a.id, a.service_date_id, a.job_id, a.person_id, a.position,
                        a.manual_override,
                        p.first_name || ' ' || p.last_name as person_name,
                        j.name as job_name
                 FROM assignments a
                 INNER JOIN people p ON a.person_id = p.id
                 INNER JOIN jobs j ON a.job_id = j.id
                 WHERE a.service_date_id = ?
                 ORDER BY j.name, a.position"
            )?;

            sd.assignments = assign_stmt
                .query_map([&sd.id], |row| {
                    Ok(Assignment {
                        id: row.get(0)?,
                        service_date_id: row.get(1)?,
                        job_id: row.get(2)?,
                        person_id: row.get(3)?,
                        position: row.get(4)?,
                        manual_override: row.get(5)?,
                        created_at: None,
                        updated_at: None,
                        person_name: row.get(6).ok(),
                        job_name: row.get(7).ok(),
                    })
                })?
                .filter_map(|r| r.ok())
                .collect();
        }

        Ok(schedule)
    })
}

#[tauri::command]
pub fn generate_schedule(request: GenerateScheduleRequest) -> Result<SchedulePreview, String> {
    let generator = ScheduleGenerator::new();
    generator.generate(request)
}

#[tauri::command]
pub fn save_schedule(preview: SchedulePreview) -> Result<Schedule, String> {
    let schedule = preview.schedule;

    let result_id = with_db(|conn| {
        // Check if schedule for this month/year already exists
        let mut check_stmt = conn.prepare(
            "SELECT id FROM schedules WHERE year = ? AND month = ?"
        )?;

        let existing_id: Option<String> = check_stmt
            .query_row(duckdb::params![schedule.year, schedule.month], |row| row.get(0))
            .ok();

        if let Some(ref existing) = existing_id {
            // Update existing schedule
            conn.execute(
                "UPDATE schedules SET name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                duckdb::params![&schedule.name, schedule.status.to_string(), &existing],
            )?;
            // Delete old service dates (cascade will handle assignments)
            conn.execute("DELETE FROM service_dates WHERE schedule_id = ?", [&existing])?;
        } else {
            // Insert new schedule
            conn.execute(
                "INSERT INTO schedules (id, name, year, month, status) VALUES (?, ?, ?, ?, ?)",
                duckdb::params![
                    &schedule.id,
                    &schedule.name,
                    schedule.year,
                    schedule.month,
                    schedule.status.to_string()
                ],
            )?;
        }

        let schedule_id = existing_id.as_ref().unwrap_or(&schedule.id);

        // Insert service dates and assignments
        for sd in &schedule.service_dates {
            let service_date_str = sd.service_date.format("%Y-%m-%d").to_string();
            conn.execute(
                "INSERT INTO service_dates (id, schedule_id, service_date, notes)
                 VALUES (?, ?, ?, ?)",
                duckdb::params![&sd.id, schedule_id, &service_date_str, &sd.notes],
            )?;

            for assignment in &sd.assignments {
                conn.execute(
                    "INSERT INTO assignments (id, service_date_id, job_id, person_id, position, manual_override)
                     VALUES (?, ?, ?, ?, ?, ?)",
                    duckdb::params![
                        &assignment.id,
                        &sd.id,
                        &assignment.job_id,
                        &assignment.person_id,
                        assignment.position,
                        assignment.manual_override
                    ],
                )?;

                // Add to assignment history
                let history_id = Uuid::new_v4().to_string();
                let week = sd.service_date.iso_week().week();
                conn.execute(
                    "INSERT INTO assignment_history (id, person_id, job_id, service_date, year, week_number)
                     VALUES (?, ?, ?, ?, ?, ?)",
                    duckdb::params![
                        &history_id,
                        &assignment.person_id,
                        &assignment.job_id,
                        &service_date_str,
                        schedule.year,
                        week as i32
                    ],
                )?;
            }
        }

        Ok(schedule_id.to_string())
    })?;

    get_schedule(result_id)
}

#[tauri::command]
pub fn update_assignment(request: UpdateAssignmentRequest) -> Result<Assignment, String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE assignments SET person_id = ?, manual_override = TRUE, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
            duckdb::params![&request.new_person_id, &request.assignment_id],
        )?;

        let mut stmt = conn.prepare(
            "SELECT a.id, a.service_date_id, a.job_id, a.person_id, a.position,
                    a.manual_override,
                    p.first_name || ' ' || p.last_name as person_name,
                    j.name as job_name
             FROM assignments a
             INNER JOIN people p ON a.person_id = p.id
             INNER JOIN jobs j ON a.job_id = j.id
             WHERE a.id = ?"
        )?;

        let assignment = stmt.query_row([&request.assignment_id], |row| {
            Ok(Assignment {
                id: row.get(0)?,
                service_date_id: row.get(1)?,
                job_id: row.get(2)?,
                person_id: row.get(3)?,
                position: row.get(4)?,
                manual_override: row.get(5)?,
                created_at: None,
                updated_at: None,
                person_name: row.get(6).ok(),
                job_name: row.get(7).ok(),
            })
        })?;

        Ok(assignment)
    })
}

#[tauri::command]
pub fn publish_schedule(id: String) -> Result<Schedule, String> {
    with_db(|conn| {
        conn.execute(
            "UPDATE schedules SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
            [&id],
        )?;
        Ok(())
    })?;

    get_schedule(id)
}

#[tauri::command]
pub fn delete_schedule(id: String) -> Result<(), String> {
    with_db(|conn| {
        // Get all service_date IDs for this schedule
        let mut stmt = conn.prepare("SELECT id, CAST(service_date AS VARCHAR) FROM service_dates WHERE schedule_id = ?")?;
        let service_dates: Vec<(String, String)> = stmt
            .query_map([&id], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        // Delete assignments for each service date
        for (sd_id, _) in &service_dates {
            conn.execute("DELETE FROM assignments WHERE service_date_id = ?", [sd_id])?;
        }

        // Delete from assignment_history for this schedule's dates
        for (_, date_str) in &service_dates {
            conn.execute("DELETE FROM assignment_history WHERE service_date = ?", [date_str])?;
        }

        // Delete service dates
        conn.execute("DELETE FROM service_dates WHERE schedule_id = ?", [&id])?;

        // Delete the schedule
        conn.execute("DELETE FROM schedules WHERE id = ?", [&id])?;

        Ok(())
    })
}

#[tauri::command]
pub fn get_fairness_scores(year: i32) -> Result<Vec<FairnessScore>, String> {
    with_db(|conn| {
        // First, get all active people with their total assignments
        let mut stmt = conn.prepare(
            "SELECT
                p.id,
                p.first_name || ' ' || p.last_name as name,
                COALESCE(COUNT(ah.id), 0) as total_assignments,
                COALESCE(SUM(CASE WHEN ah.year = ? THEN 1 ELSE 0 END), 0) as year_assignments,
                CAST(MAX(ah.service_date) AS VARCHAR) as last_date
             FROM people p
             LEFT JOIN assignment_history ah ON p.id = ah.person_id
             WHERE p.active = TRUE
             GROUP BY p.id, p.first_name, p.last_name
             ORDER BY year_assignments ASC, last_date ASC NULLS FIRST"
        )?;

        let mut scores: Vec<FairnessScore> = stmt
            .query_map([year], |row| {
                let total: i32 = row.get(2)?;
                let year_count: i32 = row.get(3)?;
                let last_date_str: Option<String> = row.get(4).ok();
                let last_date = last_date_str.and_then(|s| {
                    NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok()
                });

                // Calculate fairness score (lower assignments = higher priority)
                let fairness = if total == 0 {
                    1.0
                } else {
                    1.0 / (year_count as f64 + 1.0)
                };

                Ok(FairnessScore {
                    person_id: row.get(0)?,
                    person_name: row.get(1)?,
                    total_assignments: total,
                    assignments_this_year: year_count,
                    assignments_by_job: Vec::new(),
                    last_assignment_date: last_date,
                    fairness_score: fairness,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Now get per-job assignments for the year for each person
        let mut job_stmt = conn.prepare(
            "SELECT
                ah.person_id,
                ah.job_id,
                j.name as job_name,
                COUNT(*) as count
             FROM assignment_history ah
             INNER JOIN jobs j ON ah.job_id = j.id
             WHERE ah.year = ?
             GROUP BY ah.person_id, ah.job_id, j.name"
        )?;

        let job_counts: Vec<(String, String, String, i32)> = job_stmt
            .query_map([year], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i32>(3)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Add job counts to each score
        for score in &mut scores {
            score.assignments_by_job = job_counts
                .iter()
                .filter(|(person_id, _, _, _)| person_id == &score.person_id)
                .map(|(_, job_id, job_name, count)| JobAssignmentCount {
                    job_id: job_id.clone(),
                    job_name: job_name.clone(),
                    count: *count,
                })
                .collect();
        }

        Ok(scores)
    })
}

#[tauri::command]
pub fn get_schedule_by_month(year: i32, month: i32) -> Result<Option<Schedule>, String> {
    let id_result = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id FROM schedules WHERE year = ? AND month = ?"
        )?;

        match stmt.query_row(duckdb::params![year, month], |row| row.get::<_, String>(0)) {
            Ok(id) => Ok(Some(id)),
            Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    })?;

    match id_result {
        Some(id) => Ok(Some(get_schedule(id)?)),
        None => Ok(None),
    }
}
