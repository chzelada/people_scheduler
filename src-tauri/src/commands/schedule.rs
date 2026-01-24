use crate::db::with_db;
use crate::models::{
    Assignment, EligiblePerson, FairnessScore, GenerateScheduleRequest, GetEligiblePeopleRequest,
    JobAssignmentCount, PairingRule, Person, Schedule, SchedulePreview, ScheduleStatus,
    ServiceDate, SiblingGroup, UpdateAssignmentRequest,
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
    // Check if schedule for this month/year already exists
    let existing = with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name FROM schedules WHERE year = ? AND month = ?"
        )?;

        match stmt.query_row(duckdb::params![request.year, request.month], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }) {
            Ok((_, name)) => Ok(Some(name)),
            Err(duckdb::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    })?;

    if let Some(schedule_name) = existing {
        return Err(format!(
            "Ya existe un horario para este mes: '{}'. Debe eliminarlo antes de generar uno nuevo.",
            schedule_name
        ));
    }

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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PersonAssignmentDetail {
    pub service_date: String,
    pub job_name: String,
}

#[tauri::command]
pub fn get_person_assignment_history(
    person_id: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<PersonAssignmentDetail>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT CAST(ah.service_date AS VARCHAR), j.name
             FROM assignment_history ah
             INNER JOIN jobs j ON ah.job_id = j.id
             WHERE ah.person_id = ?
               AND ah.service_date >= ?
               AND ah.service_date <= ?
             ORDER BY ah.service_date"
        )?;

        let history: Vec<PersonAssignmentDetail> = stmt
            .query_map(duckdb::params![&person_id, &start_date, &end_date], |row| {
                Ok(PersonAssignmentDetail {
                    service_date: row.get(0)?,
                    job_name: row.get(1)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(history)
    })
}

#[tauri::command]
pub fn get_eligible_people_for_assignment(
    request: GetEligiblePeopleRequest,
) -> Result<Vec<EligiblePerson>, String> {
    let job_id = request.job_id;
    let service_date_str = request.service_date.clone();
    let current_person_id = request.current_person_id.unwrap_or_default();

    let service_date = NaiveDate::parse_from_str(&service_date_str, "%Y-%m-%d")
        .unwrap_or_else(|_| NaiveDate::from_ymd_opt(2024, 1, 1).unwrap());

    with_db(|conn| {

        // Get all active people
        let mut people_stmt = conn.prepare(
            "SELECT id, first_name, last_name, preferred_frequency, max_consecutive_weeks, preference_level
             FROM people
             WHERE active = TRUE"
        )?;

        let people: Vec<Person> = people_stmt
            .query_map([], |row| {
                Ok(Person {
                    id: row.get(0)?,
                    first_name: row.get(1)?,
                    last_name: row.get(2)?,
                    email: None,
                    phone: None,
                    preferred_frequency: crate::models::PreferredFrequency::from_str(
                        &row.get::<_, String>(3).unwrap_or_default(),
                    ),
                    max_consecutive_weeks: row.get(4)?,
                    preference_level: row.get(5)?,
                    active: true,
                    notes: None,
                    created_at: None,
                    updated_at: None,
                    job_ids: Vec::new(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Get job assignments for each person
        let mut job_assign_stmt = conn.prepare(
            "SELECT person_id, job_id FROM person_jobs"
        )?;

        let job_assignments: Vec<(String, String)> = job_assign_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        // Get unavailability records
        let mut unavail_stmt = conn.prepare(
            "SELECT person_id, CAST(start_date AS VARCHAR), CAST(end_date AS VARCHAR)
             FROM unavailability"
        )?;

        let unavailability: Vec<(String, NaiveDate, NaiveDate)> = unavail_stmt
            .query_map([], |row| {
                let start_str: String = row.get(1)?;
                let end_str: String = row.get(2)?;
                Ok((
                    row.get(0)?,
                    NaiveDate::parse_from_str(&start_str, "%Y-%m-%d").unwrap_or(service_date),
                    NaiveDate::parse_from_str(&end_str, "%Y-%m-%d").unwrap_or(service_date),
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Get people already assigned on this date from saved schedules
        let mut assigned_stmt = conn.prepare(
            "SELECT DISTINCT a.person_id
             FROM assignments a
             INNER JOIN service_dates sd ON a.service_date_id = sd.id
             WHERE sd.service_date = ?"
        )?;

        let already_assigned: Vec<String> = assigned_stmt
            .query_map(duckdb::params![&service_date_str], |row| {
                row.get(0)
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Get recent assignments for consecutive weeks check
        let mut recent_stmt = conn.prepare(
            "SELECT person_id, CAST(service_date AS VARCHAR)
             FROM assignment_history
             WHERE service_date >= ? AND service_date < ?"
        )?;

        let four_weeks_ago = service_date - chrono::Duration::days(28);
        let recent_assignments: Vec<(String, NaiveDate)> = recent_stmt
            .query_map(
                duckdb::params![
                    four_weeks_ago.format("%Y-%m-%d").to_string(),
                    service_date_str
                ],
                |row| {
                    let date_str: String = row.get(1)?;
                    Ok((
                        row.get(0)?,
                        NaiveDate::parse_from_str(&date_str, "%Y-%m-%d").unwrap_or(service_date),
                    ))
                },
            )?
            .filter_map(|r| r.ok())
            .collect();

        // Get year assignments count
        let year = service_date.year();
        let mut year_stmt = conn.prepare(
            "SELECT person_id, COUNT(*) as count
             FROM assignment_history
             WHERE year = ?
             GROUP BY person_id"
        )?;

        let year_counts: std::collections::HashMap<String, i32> = year_stmt
            .query_map([year], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        // Get sibling groups
        let mut sibling_stmt = conn.prepare(
            "SELECT id, name, pairing_rule FROM sibling_groups"
        )?;

        let mut sibling_groups: Vec<SiblingGroup> = sibling_stmt
            .query_map([], |row| {
                Ok(SiblingGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    pairing_rule: PairingRule::from_str(&row.get::<_, String>(2)?),
                    created_at: None,
                    updated_at: None,
                    member_ids: Vec::new(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        // Get sibling group members
        let mut member_stmt = conn.prepare(
            "SELECT sibling_group_id, person_id FROM sibling_group_members"
        )?;

        let members: Vec<(String, String)> = member_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for group in &mut sibling_groups {
            group.member_ids = members
                .iter()
                .filter(|(gid, _)| gid == &group.id)
                .map(|(_, pid)| pid.clone())
                .collect();
        }

        // Build eligible people list
        let mut eligible_people: Vec<EligiblePerson> = Vec::new();

        for mut person in people {
            // Add job_ids to person
            person.job_ids = job_assignments
                .iter()
                .filter(|(pid, _)| pid == &person.id)
                .map(|(_, jid)| jid.clone())
                .collect();

            let is_qualified = person.job_ids.contains(&job_id);

            let is_available = !unavailability.iter().any(|(pid, start, end)| {
                pid == &person.id && service_date >= *start && service_date <= *end
            });

            let is_already_assigned = already_assigned.contains(&person.id);

            // Check consecutive weeks
            let passes_consecutive_check =
                crate::scheduler::constraints::check_consecutive_weeks(
                    &person,
                    service_date,
                    &recent_assignments,
                );

            // Check sibling constraints
            let sibling_status =
                crate::scheduler::constraints::check_sibling_constraint(
                    &person.id,
                    &already_assigned,
                    &sibling_groups,
                );

            let sibling_status_str = match sibling_status {
                crate::scheduler::constraints::SiblingConstraintResult::Preferred => "preferred",
                crate::scheduler::constraints::SiblingConstraintResult::Neutral => "neutral",
                crate::scheduler::constraints::SiblingConstraintResult::Forbidden => "forbidden",
            };

            let year_assignments = *year_counts.get(&person.id).unwrap_or(&0);

            // Determine reason if ineligible
            let reason = if !is_qualified {
                Some("No está asignado a este trabajo".to_string())
            } else if !is_available {
                Some("No disponible en esta fecha".to_string())
            } else if is_already_assigned && person.id != current_person_id {
                Some("Ya asignado en esta fecha".to_string())
            } else if !passes_consecutive_check {
                Some("Excede semanas consecutivas".to_string())
            } else if sibling_status_str == "forbidden" {
                Some("Conflicto con regla de hermanos".to_string())
            } else {
                None
            };

            // Skip current person already assigned status (they are being replaced)
            let effective_already_assigned = if person.id == current_person_id {
                false
            } else {
                is_already_assigned
            };

            eligible_people.push(EligiblePerson {
                id: person.id,
                first_name: person.first_name,
                last_name: person.last_name,
                is_available,
                is_qualified,
                passes_consecutive_check,
                sibling_status: sibling_status_str.to_string(),
                assignments_this_year: year_assignments,
                reason_if_ineligible: if !is_qualified
                    || !is_available
                    || effective_already_assigned
                    || !passes_consecutive_check
                    || sibling_status_str == "forbidden"
                {
                    reason
                } else {
                    None
                },
            });
        }

        // Sort: eligible first (no reason), then by assignments this year
        eligible_people.sort_by(|a, b| {
            let a_eligible = a.reason_if_ineligible.is_none();
            let b_eligible = b.reason_if_ineligible.is_none();

            match (a_eligible, b_eligible) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.assignments_this_year.cmp(&b.assignments_this_year),
            }
        });

        Ok(eligible_people)
    })
}
