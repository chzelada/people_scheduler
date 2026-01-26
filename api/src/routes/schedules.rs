use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, NaiveDate, Weekday};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use std::collections::HashMap;

use crate::models::{
    Assignment, AssignmentWithDetails, GenerateScheduleRequest, Job,
    Schedule, ScheduleWithDates, ServiceDate, ServiceDateWithAssignments,
    UpdateAssignmentRequest,
};

// ============ List Schedules ============

pub async fn get_all(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Schedule>>, (StatusCode, String)> {
    let schedules = sqlx::query_as::<_, Schedule>(
        "SELECT * FROM schedules ORDER BY year DESC, month DESC"
    )
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
    person_id: String,
    position: Option<i32>,
    position_name: Option<String>,
    manual_override: Option<bool>,
    person_name: String,
    job_name: String,
}

pub async fn get_by_id(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<ScheduleWithDates>, (StatusCode, String)> {
    let schedule = sqlx::query_as::<_, Schedule>(
        "SELECT * FROM schedules WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Schedule not found".to_string()))?;

    let service_dates = sqlx::query_as::<_, ServiceDate>(
        "SELECT * FROM service_dates WHERE schedule_id = $1 ORDER BY service_date"
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
            JOIN people p ON a.person_id = p.id
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
                person_name: row.person_name,
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
    let existing = sqlx::query_scalar::<_, String>(
        "SELECT id FROM schedules WHERE year = $1 AND month = $2"
    )
    .bind(year)
    .bind(month)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((StatusCode::CONFLICT, format!("Schedule for {}/{} already exists", month, year)));
    }

    // Create schedule
    let schedule_id = Uuid::new_v4().to_string();
    let schedule_name = format!("{:02}/{}", month, year);

    let schedule = sqlx::query_as::<_, Schedule>(
        r#"
        INSERT INTO schedules (id, name, year, month, status)
        VALUES ($1, $2, $3, $4, 'DRAFT')
        RETURNING *
        "#
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
            "#
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
    let jobs = sqlx::query_as::<_, Job>(
        "SELECT * FROM jobs WHERE active = true"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Generate assignments using the algorithm
    let mut dates_with_assignments = Vec::new();

    for sd in service_dates {
        let mut assignments = Vec::new();

        for job in &jobs {
            let job_assignments = generate_job_assignments(
                &pool,
                &sd,
                job,
                year,
            ).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

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
    }.signed_duration_since(first_day).num_days();

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
) -> Result<Vec<AssignmentWithDetails>, String> {
    let num_positions = job.people_required as i32;

    // Get candidates: active people qualified for this job and available on this date
    let candidates = sqlx::query_as::<_, CandidatePerson>(
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
        "#
    )
    .bind(&job.id)
    .bind(&service_date.service_date)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    // Get assignment counts for fairness scoring
    let mut person_scores: Vec<(CandidatePerson, i64)> = Vec::new();
    for candidate in &candidates {
        let count = sqlx::query_as::<_, AssignmentCountRow>(
            "SELECT COUNT(*) as count FROM assignment_history WHERE person_id = $1 AND year = $2"
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
            "#
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

    // Assign positions using scarcity algorithm
    let mut assignments: Vec<AssignmentWithDetails> = Vec::new();
    let mut assigned_positions: Vec<i32> = Vec::new();
    let mut assigned_people: Vec<String> = Vec::new();

    for _ in 0..num_positions {
        // Find scarcest position (fewest people have it in their bag)
        let mut position_counts: HashMap<i32, usize> = HashMap::new();
        for pos in 1..=num_positions {
            if assigned_positions.contains(&pos) {
                continue;
            }
            let count = person_bags
                .iter()
                .filter(|(pid, bag)| !assigned_people.contains(pid) && bag.contains(&pos))
                .count();
            position_counts.insert(pos, count);
        }

        if position_counts.is_empty() {
            break;
        }

        // Get position with minimum count (scarcest)
        let (&scarce_pos, _) = position_counts
            .iter()
            .min_by_key(|(_, &count)| count)
            .unwrap();

        // Find person with smallest bag who has this position
        let mut candidates_for_pos: Vec<(&String, usize)> = person_bags
            .iter()
            .filter(|(pid, bag)| !assigned_people.contains(pid) && bag.contains(&scarce_pos))
            .map(|(pid, bag)| (pid, bag.len()))
            .collect();

        candidates_for_pos.sort_by_key(|(_, bag_size)| *bag_size);

        if let Some((person_id, _)) = candidates_for_pos.first() {
            let person_id = (*person_id).clone();
            let person = selected.iter().find(|p| p.id == person_id).unwrap();

            // Get position name
            let position_name = sqlx::query_scalar::<_, String>(
                "SELECT name FROM job_positions WHERE job_id = $1 AND position_number = $2"
            )
            .bind(&job.id)
            .bind(scarce_pos)
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
            .bind(scarce_pos)
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
            .bind(scarce_pos)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

            assignments.push(AssignmentWithDetails {
                assignment: Assignment {
                    id: assignment_id,
                    service_date_id: service_date.id.clone(),
                    job_id: job.id.clone(),
                    person_id: person_id.clone(),
                    position: Some(scarce_pos),
                    position_name: position_name.clone(),
                    manual_override: Some(false),
                    created_at: None,
                    updated_at: None,
                },
                person_name: format!("{} {}", person.first_name, person.last_name),
                job_name: job.name.clone(),
            });

            assigned_positions.push(scarce_pos);
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
        "#
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
        "#
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
    let current = sqlx::query_as::<_, Assignment>(
        "SELECT * FROM assignments WHERE id = $1"
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Assignment not found".to_string()))?;

    // Get service date for history update
    let sd = sqlx::query_as::<_, ServiceDate>(
        "SELECT * FROM service_dates WHERE id = $1"
    )
    .bind(&current.service_date_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update assignment
    sqlx::query(
        "UPDATE assignments SET person_id = $1, manual_override = true WHERE id = $2"
    )
    .bind(&input.person_id)
    .bind(&id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update assignment history - remove old, add new
    sqlx::query(
        r#"
        DELETE FROM assignment_history
        WHERE person_id = $1 AND job_id = $2 AND service_date = $3
        "#
    )
    .bind(&current.person_id)
    .bind(&current.job_id)
    .bind(&sd.service_date)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        JOIN people p ON a.person_id = p.id
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
        person_name: row.person_name,
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
    Err((StatusCode::NOT_IMPLEMENTED, "Excel export not yet implemented for web version".to_string()))
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
    let rows = sqlx::query_as::<_, (NaiveDate, String, String, Option<String>, Option<i32>, Option<String>)>(
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
        "#
    )
    .bind(&person_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let assignments: Vec<MyAssignment> = rows
        .into_iter()
        .map(|(service_date, job_id, job_name, job_color, position, position_name)| MyAssignment {
            service_date,
            job_id,
            job_name,
            job_color: job_color.unwrap_or_else(|| "#3B82F6".to_string()),
            position,
            position_name,
        })
        .collect();

    Ok(Json(assignments))
}
