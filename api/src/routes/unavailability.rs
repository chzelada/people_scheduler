use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::models::{CreateUnavailability, Unavailability, UnavailabilityWithPerson};

#[derive(FromRow)]
struct UnavailabilityRow {
    id: String,
    person_id: String,
    start_date: NaiveDate,
    end_date: NaiveDate,
    reason: Option<String>,
    recurring: Option<bool>,
    created_at: Option<DateTime<Utc>>,
    person_name: Option<String>,
}

pub async fn get_all(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<UnavailabilityWithPerson>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, UnavailabilityRow>(
        r#"
        SELECT
            u.id, u.person_id, u.start_date, u.end_date, u.reason, u.recurring, u.created_at,
            p.first_name || ' ' || p.last_name as person_name
        FROM unavailability u
        JOIN people p ON u.person_id = p.id
        ORDER BY u.start_date DESC
        "#
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result: Vec<UnavailabilityWithPerson> = rows
        .into_iter()
        .map(|row| UnavailabilityWithPerson {
            unavailability: Unavailability {
                id: row.id,
                person_id: row.person_id,
                start_date: row.start_date,
                end_date: row.end_date,
                reason: row.reason,
                recurring: row.recurring,
                created_at: row.created_at,
            },
            person_name: row.person_name.unwrap_or_default(),
        })
        .collect();

    Ok(Json(result))
}

pub async fn create(
    State(pool): State<PgPool>,
    Json(input): Json<CreateUnavailability>,
) -> Result<Json<Unavailability>, (StatusCode, String)> {
    let id = Uuid::new_v4().to_string();

    let unavailability = sqlx::query_as::<_, Unavailability>(
        r#"
        INSERT INTO unavailability (id, person_id, start_date, end_date, reason, recurring)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#
    )
    .bind(&id)
    .bind(&input.person_id)
    .bind(&input.start_date)
    .bind(&input.end_date)
    .bind(&input.reason)
    .bind(&input.recurring)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(unavailability))
}

pub async fn delete(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM unavailability WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Unavailability not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
