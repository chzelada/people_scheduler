use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, NaiveDate, Weekday};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{
    Assignment, AssignmentWithDetails, GenerateScheduleRequest, Job, Schedule, ScheduleWithDates,
    ServiceDate, ServiceDateWithAssignments, UpdateAssignmentRequest,
};

// ============ List Schedules ============

pub async fn get_all(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Schedule>>, (StatusCode, String)> {
    let schedules =
        sqlx::query_as::<_, Schedule>("SELECT * FROM schedules ORDER BY year DESC, month DESC")
            .fetch_all(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(schedules))
}

// ============ Get Schedule with Details ============

#[derive(FromRow)]
struct AssignmentRow {
    id: String,
    service_date_id: String,
    job_id: String,
    person_id: Option<String>,
    position: Option<i32>,
    position_name: Option<String>,
    manual_override: Option<bool>,
    person_name: Option<String>,
    job_name: String,
}

pub async fn get_by_id(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<ScheduleWithDates>, (StatusCode, String)> {
    let schedule = sqlx::query_as::<_, Schedule>("SELECT * FROM schedules WHERE id = $1")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Schedule not found".to_string()))?;

    let service_dates = sqlx::query_as::<_, ServiceDate>(
        "SELECT * FROM service_dates WHERE schedule_id = $1 ORDER BY service_date",
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut dates_with_assignments = Vec::new();

    for sd in service_dates {
        let assignments = sqlx::query_as::<_, AssignmentRow>(
            r#"
            SELECT
                a.id, a.service_date_id, a.job_id, a.person_id, a.position, a.position_name, a.manual_override,
                p.first_name || ' ' || p.last_name as person_name,
                j.name as job_name
            FROM assignments a
            LEFT JOIN people p ON a.person_id = p.id
            JOIN jobs j ON a.job_id = j.id
            WHERE a.service_date_id = $1
            ORDER BY j.name, a.position
            "#
        )
        .bind(&sd.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let assignments_with_details: Vec<AssignmentWithDetails> = assignments
            .into_iter()
            .map(|row| AssignmentWithDetails {
                assignment: Assignment {
                    id: row.id,
                    service_date_id: row.service_date_id,
                    job_id: row.job_id,
                    person_id: row.person_id,
                    position: row.position,
                    position_name: row.position_name,
                    manual_override: row.manual_override,
                    created_at: None,
                    updated_at: None,
                },
                person_name: row.person_name.unwrap_or_default(),
                job_name: row.job_name,
            })
            .collect();

        dates_with_assignments.push(ServiceDateWithAssignments {
            service_date: sd,
            assignments: assignments_with_details,
        });
    }

    Ok(Json(ScheduleWithDates {
        schedule,
        service_dates: dates_with_assignments,
    }))
}

// ============ Generate Schedule ============

pub async fn generate(
    State(pool): State<PgPool>,
    Json(input): Json<GenerateScheduleRequest>,
) -> Result<Json<ScheduleWithDates>, (StatusCode, String)> {
    let year = input.year;
    let month = input.month;

    // Check if schedule already exists
    let existing =
        sqlx::query_scalar::<_, String>("SELECT id FROM schedules WHERE year = $1 AND month = $2")
            .bind(year)
            .bind(month)
            .fetch_optional(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((
            StatusCode::CONFLICT,
            format!("Schedule for {}/{} already exists", month, year),
        ));
    }

    // Create schedule
    let schedule_id = Uuid::new_v4().to_string();
    let schedule_name = format!("{:02}/{}", month, year);

    let schedule = sqlx::query_as::<_, Schedule>(
        r#"
        INSERT INTO schedules (id, name, year, month, status)
        VALUES ($1, $2, $3, $4, 'DRAFT')
        RETURNING *
        "#,
    )
    .bind(&schedule_id)
    .bind(&schedule_name)
    .bind(year)
    .bind(month)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get Sundays of the month
    let sundays = get_sundays_of_month(year, month as u32);

    // Create service dates
    let mut service_dates = Vec::new();
    for sunday in &sundays {
        let sd_id = Uuid::new_v4().to_string();
        let sd = sqlx::query_as::<_, ServiceDate>(
            r#"
            INSERT INTO service_dates (id, schedule_id, service_date)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(&sd_id)
        .bind(&schedule_id)
        .bind(sunday)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        service_dates.push(sd);
    }

    // Get jobs
    let jobs = sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE active = true")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Generate assignments using the algorithm
    let mut dates_with_assignments = Vec::new();

    for sd in service_dates {
        let mut assignments = Vec::new();
        // Track person_id -> job_id for exclusivity checking
        let mut assigned_this_date: HashMap<String, String> = HashMap::new();

        for job in &jobs {
            let job_assignments =
                generate_job_assignments(&pool, &sd, job, year, &assigned_this_date)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

            // Track who was assigned to this job
            for assignment in &job_assignments {
                if let Some(pid) = &assignment.assignment.person_id {
                    assigned_this_date.insert(pid.clone(), job.id.clone());
                }
            }

            assignments.extend(job_assignments);
        }

        dates_with_assignments.push(ServiceDateWithAssignments {
            service_date: sd,
            assignments,
        });
    }

    Ok(Json(ScheduleWithDates {
        schedule,
        service_dates: dates_with_assignments,
    }))
}

// Helper: Get Sundays of a month
fn get_sundays_of_month(year: i32, month: u32) -> Vec<NaiveDate> {
    let mut sundays = Vec::new();
    let first_day = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let days_in_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap()
    }
    .signed_duration_since(first_day)
    .num_days();

    for day in 1..=days_in_month as u32 {
        if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
            if date.weekday() == Weekday::Sun {
                sundays.push(date);
            }
        }
    }

    sundays
}

// ============ Scheduling Algorithm ============

/// Check if two jobs are mutually exclusive (a person can only be assigned to one per date)
fn are_jobs_exclusive(job1: &str, job2: &str) -> bool {
    let exclusive_pairs = [
        ("monaguillos", "monaguillos_jr"),
        ("monaguillos", "lectores"),  // Can't be monaguillo and lector same day
    ];
    exclusive_pairs
        .iter()
        .any(|(a, b)| (job1 == *a && job2 == *b) || (job1 == *b && job2 == *a))
}

/// Check if a job has the consecutive month restriction (monaguillos and lectores only)
fn has_consecutive_month_restriction(job_id: &str) -> bool {
    job_id == "monaguillos" || job_id == "lectores"
}

/// Count Sundays in a given month
fn count_sundays_in_month(year: i32, month: u32) -> u32 {
    get_sundays_of_month(year, month).len() as u32
}

#[derive(FromRow, Clone)]
struct CandidatePerson {
    id: String,
    first_name: String,
    last_name: String,
}

#[derive(FromRow)]
struct AssignmentCountRow {
    count: i64,
}

#[derive(FromRow)]
#[allow(dead_code)]
struct HistoryPositionRow {
    position: Option<i32>,
    service_date: NaiveDate, // Used for ordering in query
}

async fn generate_job_assignments(
    pool: &PgPool,
    service_date: &ServiceDate,
    job: &Job,
    year: i32,
    assigned_this_date: &HashMap<String, String>,
) -> Result<Vec<AssignmentWithDetails>, String> {
    let num_positions = job.people_required as i32;

    // Get candidates: active people qualified for this job and available on this date
    let all_candidates = sqlx::query_as::<_, CandidatePerson>(
        r#"
        SELECT DISTINCT p.id, p.first_name, p.last_name
        FROM people p
        JOIN person_jobs pj ON p.id = pj.person_id
        WHERE pj.job_id = $1
          AND p.active = true
          AND NOT EXISTS (
              SELECT 1 FROM unavailability u
              WHERE u.person_id = p.id
                AND $2 BETWEEN u.start_date AND u.end_date
          )
        "#,
    )
    .bind(&job.id)
    .bind(&service_date.service_date)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Filter out candidates already assigned to an exclusive job
    let mut candidates: Vec<CandidatePerson> = all_candidates
        .into_iter()
        .filter(|candidate| {
            // Check if this person is already assigned to an exclusive job
            if let Some(assigned_job_id) = assigned_this_date.get(&candidate.id) {
                // If they're assigned to an exclusive job, exclude them
                !are_jobs_exclusive(assigned_job_id, &job.id)
            } else {
                // Not assigned yet, include them
                true
            }
        })
        .collect();

    // Apply consecutive month restriction for monaguillos and lectores
    // Rule: Cannot serve in same role two consecutive months, UNLESS current month has 5 Sundays
    if has_consecutive_month_restriction(&job.id) {
        let current_month = service_date.service_date.month();
        let current_year = service_date.service_date.year();
        let sundays_this_month = count_sundays_in_month(current_year, current_month);

        // Only apply restriction if current month has 4 or fewer Sundays
        if sundays_this_month <= 4 {
            // Calculate previous month
            let (prev_year, prev_month) = if current_month == 1 {
                (current_year - 1, 12u32)
            } else {
                (current_year, current_month - 1)
            };

            // Get list of people who served in this job last month
            let served_last_month: Vec<String> = sqlx::query_scalar(
                r#"
                SELECT DISTINCT person_id
                FROM assignment_history
                WHERE job_id = $1
                  AND EXTRACT(YEAR FROM service_date) = $2
                  AND EXTRACT(MONTH FROM service_date) = $3
                "#,
            )
            .bind(&job.id)
            .bind(prev_year)
            .bind(prev_month as i32)
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

            // Filter out those who served last month
            candidates.retain(|c| !served_last_month.contains(&c.id));

            tracing::info!(
                "Consecutive month filter for {}: {} served last month, {} candidates remaining",
                job.id,
                served_last_month.len(),
                candidates.len()
            );
        } else {
            tracing::info!(
                "Skipping consecutive month restriction for {} - month has {} Sundays",
                job.id,
                sundays_this_month
            );
        }
    }

    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    // Get assignment counts for fairness scoring
    let mut person_scores: Vec<(CandidatePerson, i64)> = Vec::new();
    for candidate in &candidates {
        let count = sqlx::query_as::<_, AssignmentCountRow>(
            "SELECT COUNT(*) as count FROM assignment_history WHERE person_id = $1 AND year = $2",
        )
        .bind(&candidate.id)
        .bind(year)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

        person_scores.push((candidate.clone(), count.count));
    }

    // Sort by fewest assignments (fairness)
    person_scores.sort_by_key(|(_, count)| *count);

    // Select top N people
    let selected: Vec<CandidatePerson> = person_scores
        .into_iter()
        .take(num_positions as usize)
        .map(|(p, _)| p)
        .collect();

    // Build position bags for rotation algorithm
    let mut person_bags: HashMap<String, Vec<i32>> = HashMap::new();

    for person in &selected {
        // Get this person's position history for this job
        let history = sqlx::query_as::<_, HistoryPositionRow>(
            r#"
            SELECT position, service_date
            FROM assignment_history
            WHERE person_id = $1 AND job_id = $2
            ORDER BY service_date DESC
            "#,
        )
        .bind(&person.id)
        .bind(&job.id)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

        // Find positions in current cycle
        let mut positions_in_cycle: Vec<i32> = Vec::new();
        for h in &history {
            if let Some(pos) = h.position {
                if positions_in_cycle.contains(&pos) {
                    // Found a repeat, cycle boundary
                    break;
                }
                positions_in_cycle.push(pos);
            }
        }

        // Bag = positions NOT in current cycle
        let bag: Vec<i32> = (1..=num_positions)
            .filter(|pos| !positions_in_cycle.contains(pos))
            .collect();

        // If bag is empty, refill
        let bag = if bag.is_empty() {
            (1..=num_positions).collect()
        } else {
            bag
        };

        person_bags.insert(person.id.clone(), bag);
    }

    // Assign positions using simplified algorithm
    // Prioritize positions in bags, but fall back to any unassigned person
    let mut assignments: Vec<AssignmentWithDetails> = Vec::new();
    let mut assigned_positions: Vec<i32> = Vec::new();
    let mut assigned_people: Vec<String> = Vec::new();

    for pos in 1..=num_positions {
        // Find person with this position in their bag (rotation preference)
        let mut candidates_for_pos: Vec<(&String, usize)> = person_bags
            .iter()
            .filter(|(pid, bag)| !assigned_people.contains(pid) && bag.contains(&pos))
            .map(|(pid, bag)| (pid, bag.len()))
            .collect();

        // Sort by smallest bag (most constrained first)
        candidates_for_pos.sort_by_key(|(_, bag_size)| *bag_size);

        // If no one has this position in their bag, fall back to any unassigned person
        let person_id = if let Some((pid, _)) = candidates_for_pos.first() {
            (*pid).clone()
        } else {
            // Fallback: pick any unassigned person from selected
            match selected.iter().find(|p| !assigned_people.contains(&p.id)) {
                Some(p) => p.id.clone(),
                None => break, // No more people available
            }
        };

        if !assigned_people.contains(&person_id) {
            let person = selected.iter().find(|p| p.id == person_id).unwrap();

            // Get position name
            let position_name = sqlx::query_scalar::<_, String>(
                "SELECT name FROM job_positions WHERE job_id = $1 AND position_number = $2",
            )
            .bind(&job.id)
            .bind(pos)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;

            // Create assignment
            let assignment_id = Uuid::new_v4().to_string();
            sqlx::query(
                r#"
                INSERT INTO assignments (id, service_date_id, job_id, person_id, position, position_name)
                VALUES ($1, $2, $3, $4, $5, $6)
                "#
            )
            .bind(&assignment_id)
            .bind(&service_date.id)
            .bind(&job.id)
            .bind(&person_id)
            .bind(pos)
            .bind(&position_name)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

            // Create history entry
            let history_id = Uuid::new_v4().to_string();
            let week_number = service_date.service_date.iso_week().week() as i32;
            sqlx::query(
                r#"
                INSERT INTO assignment_history (id, person_id, job_id, service_date, year, week_number, position)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                "#
            )
            .bind(&history_id)
            .bind(&person_id)
            .bind(&job.id)
            .bind(&service_date.service_date)
            .bind(year)
            .bind(week_number)
            .bind(pos)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

            assignments.push(AssignmentWithDetails {
                assignment: Assignment {
                    id: assignment_id,
                    service_date_id: service_date.id.clone(),
                    job_id: job.id.clone(),
                    person_id: Some(person_id.clone()),
                    position: Some(pos),
                    position_name: position_name.clone(),
                    manual_override: Some(false),
                    created_at: None,
                    updated_at: None,
                },
                person_name: format!("{} {}", person.first_name, person.last_name),
                job_name: job.name.clone(),
            });

            assigned_positions.push(pos);
            assigned_people.push(person_id);
        }
    }

    Ok(assignments)
}

// ============ Publish Schedule ============

pub async fn publish(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<Schedule>, (StatusCode, String)> {
    let schedule = sqlx::query_as::<_, Schedule>(
        r#"
        UPDATE schedules
        SET status = 'PUBLISHED', published_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(schedule))
}

// ============ Delete Schedule ============

pub async fn delete(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Delete assignment history for this schedule's dates
    sqlx::query(
        r#"
        DELETE FROM assignment_history
        WHERE service_date IN (
            SELECT service_date FROM service_dates WHERE schedule_id = $1
        )
        "#,
    )
    .bind(&id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Delete schedule (cascades to service_dates and assignments)
    let result = sqlx::query("DELETE FROM schedules WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Schedule not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ============ Update Assignment ============

pub async fn update_assignment(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    Json(input): Json<UpdateAssignmentRequest>,
) -> Result<Json<AssignmentWithDetails>, (StatusCode, String)> {
    // Get current assignment
    let current = sqlx::query_as::<_, Assignment>("SELECT * FROM assignments WHERE id = $1")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Assignment not found".to_string()))?;

    // Get service date for history update
    let sd = sqlx::query_as::<_, ServiceDate>("SELECT * FROM service_dates WHERE id = $1")
        .bind(&current.service_date_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update assignment
    sqlx::query("UPDATE assignments SET person_id = $1, manual_override = true WHERE id = $2")
        .bind(&input.person_id)
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update assignment history - remove old entry if there was a person
    if let Some(old_person_id) = &current.person_id {
        sqlx::query(
            r#"
            DELETE FROM assignment_history
            WHERE person_id = $1 AND job_id = $2 AND service_date = $3
            "#,
        )
        .bind(old_person_id)
        .bind(&current.job_id)
        .bind(&sd.service_date)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Add new history entry
    let history_id = Uuid::new_v4().to_string();
    let year = sd.service_date.year();
    let week_number = sd.service_date.iso_week().week() as i32;

    sqlx::query(
        r#"
        INSERT INTO assignment_history (id, person_id, job_id, service_date, year, week_number, position)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#
    )
    .bind(&history_id)
    .bind(&input.person_id)
    .bind(&current.job_id)
    .bind(&sd.service_date)
    .bind(year)
    .bind(week_number)
    .bind(current.position)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Return updated assignment with details
    let row = sqlx::query_as::<_, AssignmentRow>(
        r#"
        SELECT
            a.id, a.service_date_id, a.job_id, a.person_id, a.position, a.position_name, a.manual_override,
            p.first_name || ' ' || p.last_name as person_name,
            j.name as job_name
        FROM assignments a
        LEFT JOIN people p ON a.person_id = p.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = $1
        "#
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AssignmentWithDetails {
        assignment: Assignment {
            id: row.id,
            service_date_id: row.service_date_id,
            job_id: row.job_id,
            person_id: row.person_id,
            position: row.position,
            position_name: row.position_name,
            manual_override: row.manual_override,
            created_at: None,
            updated_at: None,
        },
        person_name: row.person_name.unwrap_or_default(),
        job_name: row.job_name,
    }))
}

// ============ Export Excel ============

pub async fn export_excel(
    State(_pool): State<PgPool>,
    Path(_id): Path<String>,
) -> Result<Vec<u8>, (StatusCode, String)> {
    // TODO: Implement Excel export
    // For now, return a placeholder
    Err((
        StatusCode::NOT_IMPLEMENTED,
        "Excel export not yet implemented for web version".to_string(),
    ))
}

// ============ Get My Assignments (for Servidores) ============

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MyAssignment {
    pub service_date: NaiveDate,
    pub job_id: String,
    pub job_name: String,
    pub job_color: String,
    pub position: Option<i32>,
    pub position_name: Option<String>,
}

pub async fn get_my_assignments(
    State(pool): State<PgPool>,
    Path(person_id): Path<String>,
) -> Result<Json<Vec<MyAssignment>>, (StatusCode, String)> {
    // Get all assignments for this person from published schedules
    // Order by: future dates first (ascending), then past dates (descending)
    let rows = sqlx::query_as::<
        _,
        (
            NaiveDate,
            String,
            String,
            Option<String>,
            Option<i32>,
            Option<String>,
        ),
    >(
        r#"
        SELECT
            sd.service_date,
            j.id as job_id,
            j.name as job_name,
            j.color as job_color,
            a.position,
            a.position_name
        FROM assignments a
        JOIN service_dates sd ON a.service_date_id = sd.id
        JOIN schedules s ON sd.schedule_id = s.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.person_id = $1
          AND s.status = 'PUBLISHED'
        ORDER BY
            CASE WHEN sd.service_date >= CURRENT_DATE THEN 0 ELSE 1 END,
            CASE WHEN sd.service_date >= CURRENT_DATE THEN sd.service_date END ASC,
            CASE WHEN sd.service_date < CURRENT_DATE THEN sd.service_date END DESC
        "#,
    )
    .bind(&person_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let assignments: Vec<MyAssignment> = rows
        .into_iter()
        .map(
            |(service_date, job_id, job_name, job_color, position, position_name)| MyAssignment {
                service_date,
                job_id,
                job_name,
                job_color: job_color.unwrap_or_else(|| "#3B82F6".to_string()),
                position,
                position_name,
            },
        )
        .collect();

    Ok(Json(assignments))
}

// ============ Clear Assignment (remove person from slot) ============

pub async fn clear_assignment(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<AssignmentWithDetails>, (StatusCode, String)> {
    // Get current assignment
    let current = sqlx::query_as::<_, Assignment>("SELECT * FROM assignments WHERE id = $1")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Assignment not found".to_string()))?;

    // Get service date for history update
    let sd = sqlx::query_as::<_, ServiceDate>("SELECT * FROM service_dates WHERE id = $1")
        .bind(&current.service_date_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Clear the person_id (set to NULL)
    sqlx::query("UPDATE assignments SET person_id = NULL, manual_override = true WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Remove from assignment history if there was a person
    if let Some(old_person_id) = &current.person_id {
        sqlx::query(
            r#"
            DELETE FROM assignment_history
            WHERE person_id = $1 AND job_id = $2 AND service_date = $3
            "#,
        )
        .bind(old_person_id)
        .bind(&current.job_id)
        .bind(&sd.service_date)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Return updated assignment with details
    let row = sqlx::query_as::<_, AssignmentRow>(
        r#"
        SELECT
            a.id, a.service_date_id, a.job_id, a.person_id, a.position, a.position_name, a.manual_override,
            p.first_name || ' ' || p.last_name as person_name,
            j.name as job_name
        FROM assignments a
        LEFT JOIN people p ON a.person_id = p.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = $1
        "#
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AssignmentWithDetails {
        assignment: Assignment {
            id: row.id,
            service_date_id: row.service_date_id,
            job_id: row.job_id,
            person_id: row.person_id,
            position: row.position,
            position_name: row.position_name,
            manual_override: row.manual_override,
            created_at: None,
            updated_at: None,
        },
        person_name: row.person_name.unwrap_or_default(),
        job_name: row.job_name,
    }))
}

// ============ Helper: Check if person is qualified for job ============

async fn is_person_qualified_for_job(
    pool: &PgPool,
    person_id: &str,
    job_id: &str,
) -> Result<bool, String> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM person_jobs WHERE person_id = $1 AND job_id = $2)",
    )
    .bind(person_id)
    .bind(job_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(exists)
}

async fn get_person_name(pool: &PgPool, person_id: &str) -> Result<String, String> {
    let name: String =
        sqlx::query_scalar("SELECT first_name || ' ' || last_name FROM people WHERE id = $1")
            .bind(person_id)
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?;

    Ok(name)
}

async fn get_job_name(pool: &PgPool, job_id: &str) -> Result<String, String> {
    let name: String = sqlx::query_scalar("SELECT name FROM jobs WHERE id = $1")
        .bind(job_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(name)
}

// ============ Swap Assignments ============

#[derive(Debug, serde::Deserialize)]
pub struct SwapAssignmentsRequest {
    pub assignment_id_1: String,
    pub assignment_id_2: String,
}

pub async fn swap_assignments(
    State(pool): State<PgPool>,
    Json(input): Json<SwapAssignmentsRequest>,
) -> Result<Json<Vec<AssignmentWithDetails>>, (StatusCode, String)> {
    // Get both assignments
    let assignment1 = sqlx::query_as::<_, Assignment>("SELECT * FROM assignments WHERE id = $1")
        .bind(&input.assignment_id_1)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Assignment 1 not found".to_string()))?;

    let assignment2 = sqlx::query_as::<_, Assignment>("SELECT * FROM assignments WHERE id = $1")
        .bind(&input.assignment_id_2)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Assignment 2 not found".to_string()))?;

    // Validate job qualifications before swapping
    // Check if person1 is qualified for assignment2's job
    if let Some(p1) = &assignment1.person_id {
        if assignment1.job_id != assignment2.job_id {
            let is_qualified = is_person_qualified_for_job(&pool, p1, &assignment2.job_id)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            if !is_qualified {
                let person_name = get_person_name(&pool, p1)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
                let job_name = get_job_name(&pool, &assignment2.job_id)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
                return Err((
                    StatusCode::BAD_REQUEST,
                    format!("{} no está configurado como {}", person_name, job_name),
                ));
            }
        }
    }

    // Check if person2 is qualified for assignment1's job
    if let Some(p2) = &assignment2.person_id {
        if assignment1.job_id != assignment2.job_id {
            let is_qualified = is_person_qualified_for_job(&pool, p2, &assignment1.job_id)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            if !is_qualified {
                let person_name = get_person_name(&pool, p2)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
                let job_name = get_job_name(&pool, &assignment1.job_id)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
                return Err((
                    StatusCode::BAD_REQUEST,
                    format!("{} no está configurado como {}", person_name, job_name),
                ));
            }
        }
    }

    // Get service dates for history updates
    let sd1 = sqlx::query_as::<_, ServiceDate>("SELECT * FROM service_dates WHERE id = $1")
        .bind(&assignment1.service_date_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let sd2 = sqlx::query_as::<_, ServiceDate>("SELECT * FROM service_dates WHERE id = $1")
        .bind(&assignment2.service_date_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Swap person_ids
    let person1 = assignment1.person_id.clone();
    let person2 = assignment2.person_id.clone();

    // To avoid unique constraint violation, we need to use NULL as intermediate step:
    // 1. Set assignment 1 to NULL
    // 2. Set assignment 2 to person1
    // 3. Set assignment 1 to person2

    // Step 1: Clear assignment 1
    sqlx::query("UPDATE assignments SET person_id = NULL, manual_override = true WHERE id = $1")
        .bind(&input.assignment_id_1)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Step 2: Update assignment 2 with person 1
    sqlx::query("UPDATE assignments SET person_id = $1, manual_override = true WHERE id = $2")
        .bind(&person1)
        .bind(&input.assignment_id_2)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Step 3: Update assignment 1 with person 2
    sqlx::query("UPDATE assignments SET person_id = $1, manual_override = true WHERE id = $2")
        .bind(&person2)
        .bind(&input.assignment_id_1)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update assignment history for person 1
    if let Some(p1) = &person1 {
        // Remove old history entry for person 1 at slot 1
        sqlx::query(
            "DELETE FROM assignment_history WHERE person_id = $1 AND job_id = $2 AND service_date = $3"
        )
        .bind(p1)
        .bind(&assignment1.job_id)
        .bind(&sd1.service_date)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Add new history entry for person 1 at slot 2
        let history_id = Uuid::new_v4().to_string();
        let year = sd2.service_date.year();
        let week_number = sd2.service_date.iso_week().week() as i32;
        sqlx::query(
            r#"
            INSERT INTO assignment_history (id, person_id, job_id, service_date, year, week_number, position)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(&history_id)
        .bind(p1)
        .bind(&assignment2.job_id)
        .bind(&sd2.service_date)
        .bind(year)
        .bind(week_number)
        .bind(assignment2.position)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Update assignment history for person 2
    if let Some(p2) = &person2 {
        // Remove old history entry for person 2 at slot 2
        sqlx::query(
            "DELETE FROM assignment_history WHERE person_id = $1 AND job_id = $2 AND service_date = $3"
        )
        .bind(p2)
        .bind(&assignment2.job_id)
        .bind(&sd2.service_date)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Add new history entry for person 2 at slot 1
        let history_id = Uuid::new_v4().to_string();
        let year = sd1.service_date.year();
        let week_number = sd1.service_date.iso_week().week() as i32;
        sqlx::query(
            r#"
            INSERT INTO assignment_history (id, person_id, job_id, service_date, year, week_number, position)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#
        )
        .bind(&history_id)
        .bind(p2)
        .bind(&assignment1.job_id)
        .bind(&sd1.service_date)
        .bind(year)
        .bind(week_number)
        .bind(assignment1.position)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Return both updated assignments
    let mut results = Vec::new();

    for id in [&input.assignment_id_1, &input.assignment_id_2] {
        let row = sqlx::query_as::<_, AssignmentRow>(
            r#"
            SELECT
                a.id, a.service_date_id, a.job_id, a.person_id, a.position, a.position_name, a.manual_override,
                p.first_name || ' ' || p.last_name as person_name,
                j.name as job_name
            FROM assignments a
            LEFT JOIN people p ON a.person_id = p.id
            JOIN jobs j ON a.job_id = j.id
            WHERE a.id = $1
            "#
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        results.push(AssignmentWithDetails {
            assignment: Assignment {
                id: row.id,
                service_date_id: row.service_date_id,
                job_id: row.job_id,
                person_id: row.person_id,
                position: row.position,
                position_name: row.position_name,
                manual_override: row.manual_override,
                created_at: None,
                updated_at: None,
            },
            person_name: row.person_name.unwrap_or_default(),
            job_name: row.job_name,
        });
    }

    Ok(Json(results))
}

// ============ Move Assignment ============

#[derive(Debug, serde::Deserialize)]
pub struct MoveAssignmentRequest {
    pub target_service_date_id: String,
    pub target_job_id: String,
    pub target_position: i32,
}

pub async fn move_assignment(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    Json(input): Json<MoveAssignmentRequest>,
) -> Result<Json<Vec<AssignmentWithDetails>>, (StatusCode, String)> {
    // Get source assignment
    let source = sqlx::query_as::<_, Assignment>("SELECT * FROM assignments WHERE id = $1")
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Assignment not found".to_string()))?;

    // Validate job qualification if moving to a different job
    if let Some(person_id) = &source.person_id {
        if source.job_id != input.target_job_id {
            let is_qualified = is_person_qualified_for_job(&pool, person_id, &input.target_job_id)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            if !is_qualified {
                let person_name = get_person_name(&pool, person_id)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
                let job_name = get_job_name(&pool, &input.target_job_id)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
                return Err((
                    StatusCode::BAD_REQUEST,
                    format!("{} no está configurado como {}", person_name, job_name),
                ));
            }
        }
    }

    // Check if target slot exists
    let target = sqlx::query_as::<_, Assignment>(
        "SELECT * FROM assignments WHERE service_date_id = $1 AND job_id = $2 AND position = $3",
    )
    .bind(&input.target_service_date_id)
    .bind(&input.target_job_id)
    .bind(input.target_position)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(target_assignment) = target {
        // Target slot exists - if it has a person, swap; if empty, move
        if target_assignment.person_id.is_some() {
            // Swap
            return swap_assignments(
                State(pool),
                Json(SwapAssignmentsRequest {
                    assignment_id_1: id,
                    assignment_id_2: target_assignment.id,
                }),
            )
            .await;
        } else {
            // Target is empty - move source person to target, clear source
            let source_sd =
                sqlx::query_as::<_, ServiceDate>("SELECT * FROM service_dates WHERE id = $1")
                    .bind(&source.service_date_id)
                    .fetch_one(&pool)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let target_sd =
                sqlx::query_as::<_, ServiceDate>("SELECT * FROM service_dates WHERE id = $1")
                    .bind(&input.target_service_date_id)
                    .fetch_one(&pool)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            // Move person to target
            sqlx::query(
                "UPDATE assignments SET person_id = $1, manual_override = true WHERE id = $2",
            )
            .bind(&source.person_id)
            .bind(&target_assignment.id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            // Clear source
            sqlx::query(
                "UPDATE assignments SET person_id = NULL, manual_override = true WHERE id = $1",
            )
            .bind(&id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            // Update history
            if let Some(person_id) = &source.person_id {
                // Remove old history
                sqlx::query(
                    "DELETE FROM assignment_history WHERE person_id = $1 AND job_id = $2 AND service_date = $3"
                )
                .bind(person_id)
                .bind(&source.job_id)
                .bind(&source_sd.service_date)
                .execute(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                // Add new history at target
                let history_id = Uuid::new_v4().to_string();
                let year = target_sd.service_date.year();
                let week_number = target_sd.service_date.iso_week().week() as i32;
                sqlx::query(
                    r#"
                    INSERT INTO assignment_history (id, person_id, job_id, service_date, year, week_number, position)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    "#
                )
                .bind(&history_id)
                .bind(person_id)
                .bind(&input.target_job_id)
                .bind(&target_sd.service_date)
                .bind(year)
                .bind(week_number)
                .bind(input.target_position)
                .execute(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            }

            // Return both updated assignments
            let mut results = Vec::new();
            for aid in [&id, &target_assignment.id] {
                let row = sqlx::query_as::<_, AssignmentRow>(
                    r#"
                    SELECT
                        a.id, a.service_date_id, a.job_id, a.person_id, a.position, a.position_name, a.manual_override,
                        p.first_name || ' ' || p.last_name as person_name,
                        j.name as job_name
                    FROM assignments a
                    LEFT JOIN people p ON a.person_id = p.id
                    JOIN jobs j ON a.job_id = j.id
                    WHERE a.id = $1
                    "#
                )
                .bind(aid)
                .fetch_one(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                results.push(AssignmentWithDetails {
                    assignment: Assignment {
                        id: row.id,
                        service_date_id: row.service_date_id,
                        job_id: row.job_id,
                        person_id: row.person_id,
                        position: row.position,
                        position_name: row.position_name,
                        manual_override: row.manual_override,
                        created_at: None,
                        updated_at: None,
                    },
                    person_name: row.person_name.unwrap_or_default(),
                    job_name: row.job_name,
                });
            }
            return Ok(Json(results));
        }
    }

    // Target slot doesn't exist - this shouldn't happen in normal flow
    Err((StatusCode::NOT_FOUND, "Target slot not found".to_string()))
}

// ============ Get Schedule Completeness ============

#[derive(Debug, serde::Serialize)]
pub struct EmptySlot {
    pub service_date: String,
    pub job_name: String,
    pub position_name: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct CompletenessResponse {
    pub is_complete: bool,
    pub total_slots: i64,
    pub filled_slots: i64,
    pub empty_slots: Vec<EmptySlot>,
}

pub async fn get_schedule_completeness(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<CompletenessResponse>, (StatusCode, String)> {
    // Count total and filled slots
    let total_slots: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM assignments a
        JOIN service_dates sd ON a.service_date_id = sd.id
        WHERE sd.schedule_id = $1
        "#,
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let filled_slots: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*) FROM assignments a
        JOIN service_dates sd ON a.service_date_id = sd.id
        WHERE sd.schedule_id = $1 AND a.person_id IS NOT NULL
        "#,
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get empty slots details
    let empty_rows: Vec<(NaiveDate, String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT sd.service_date, j.name as job_name, a.position_name
        FROM assignments a
        JOIN service_dates sd ON a.service_date_id = sd.id
        JOIN jobs j ON a.job_id = j.id
        WHERE sd.schedule_id = $1 AND a.person_id IS NULL
        ORDER BY sd.service_date, j.name, a.position
        "#,
    )
    .bind(&id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let empty_slots: Vec<EmptySlot> = empty_rows
        .into_iter()
        .map(|(service_date, job_name, position_name)| EmptySlot {
            service_date: service_date.to_string(),
            job_name,
            position_name,
        })
        .collect();

    Ok(Json(CompletenessResponse {
        is_complete: filled_slots == total_slots,
        total_slots,
        filled_slots,
        empty_slots,
    }))
}
