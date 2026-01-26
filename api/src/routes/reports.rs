use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use sqlx::{FromRow, PgPool};

use crate::models::{FairnessScore, JobAssignmentCount, PersonHistoryEntry};

#[derive(Deserialize)]
pub struct FairnessQuery {
    year: i32,
}

#[derive(FromRow)]
struct FairnessRow {
    person_id: String,
    person_name: String,
    assignments_this_year: i64,
    last_assignment_date: Option<NaiveDate>,
}

#[derive(FromRow)]
struct JobCountRow {
    job_name: String,
    count: i64,
}

pub async fn get_fairness_scores(
    State(pool): State<PgPool>,
    Query(query): Query<FairnessQuery>,
) -> Result<Json<Vec<FairnessScore>>, (StatusCode, String)> {
    // Get all active people with their assignment counts
    let rows = sqlx::query_as::<_, FairnessRow>(
        r#"
        SELECT
            p.id as person_id,
            p.first_name || ' ' || p.last_name as person_name,
            COALESCE(COUNT(ah.id), 0) as assignments_this_year,
            MAX(ah.service_date) as last_assignment_date
        FROM people p
        LEFT JOIN assignment_history ah ON p.id = ah.person_id AND ah.year = $1
        WHERE p.active = true
        GROUP BY p.id, p.first_name, p.last_name
        ORDER BY assignments_this_year DESC, p.last_name, p.first_name
        "#
    )
    .bind(query.year)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result = Vec::new();

    for row in rows {
        // Get assignments by job for this person
        let job_counts = sqlx::query_as::<_, JobCountRow>(
            r#"
            SELECT
                j.name as job_name,
                COUNT(*) as count
            FROM assignment_history ah
            JOIN jobs j ON ah.job_id = j.id
            WHERE ah.person_id = $1 AND ah.year = $2
            GROUP BY j.name
            "#
        )
        .bind(&row.person_id)
        .bind(query.year)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let assignments_by_job: Vec<JobAssignmentCount> = job_counts
            .into_iter()
            .map(|jc| JobAssignmentCount {
                job_name: jc.job_name,
                count: jc.count,
            })
            .collect();

        result.push(FairnessScore {
            person_id: row.person_id,
            person_name: row.person_name,
            assignments_this_year: row.assignments_this_year,
            last_assignment_date: row.last_assignment_date,
            assignments_by_job,
        });
    }

    Ok(Json(result))
}

#[derive(FromRow)]
struct HistoryRow {
    service_date: NaiveDate,
    job_id: String,
    job_name: String,
    position: Option<i32>,
    position_name: Option<String>,
}

pub async fn get_person_history(
    State(pool): State<PgPool>,
    Path(person_id): Path<String>,
) -> Result<Json<Vec<PersonHistoryEntry>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, HistoryRow>(
        r#"
        SELECT
            ah.service_date,
            ah.job_id,
            j.name as job_name,
            ah.position,
            jp.name as position_name
        FROM assignment_history ah
        JOIN jobs j ON ah.job_id = j.id
        LEFT JOIN job_positions jp ON ah.job_id = jp.job_id AND ah.position = jp.position_number
        WHERE ah.person_id = $1
        ORDER BY ah.service_date DESC
        "#
    )
    .bind(&person_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result: Vec<PersonHistoryEntry> = rows
        .into_iter()
        .map(|row| PersonHistoryEntry {
            service_date: row.service_date,
            job_id: row.job_id,
            job_name: row.job_name,
            position: row.position,
            position_name: row.position_name,
        })
        .collect();

    Ok(Json(result))
}
