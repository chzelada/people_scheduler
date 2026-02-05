use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::auth::Claims;
use crate::models::{CreateUnavailability, Unavailability, UnavailabilityWithPerson};

// Input for servidor self-service unavailability
#[derive(Debug, Deserialize)]
pub struct CreateMyUnavailability {
    pub dates: Vec<NaiveDate>, // List of dates to mark as unavailable
    pub reason: Option<String>,
}

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
        "#,
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
) -> Result<Json<UnavailabilityWithPerson>, (StatusCode, String)> {
    let id = Uuid::new_v4().to_string();

    // Insert and fetch with person name in one query
    let row = sqlx::query_as::<_, UnavailabilityRow>(
        r#"
        INSERT INTO unavailability (id, person_id, start_date, end_date, reason, recurring)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id, person_id, start_date, end_date, reason, recurring, created_at,
            (SELECT first_name || ' ' || last_name FROM people WHERE id = $2) as person_name
        "#,
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

    let result = UnavailabilityWithPerson {
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
    };

    Ok(Json(result))
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
        return Err((
            StatusCode::NOT_FOUND,
            "Unavailability not found".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ============ Self-service endpoints for servidores ============

// Get my unavailability records
pub async fn get_my_unavailability(
    State(pool): State<PgPool>,
    claims: Claims,
) -> Result<Json<Vec<Unavailability>>, (StatusCode, String)> {
    let person_id = claims.person_id.ok_or((
        StatusCode::FORBIDDEN,
        "No tiene un servidor vinculado a su cuenta".to_string(),
    ))?;

    let records = sqlx::query_as::<_, Unavailability>(
        r#"
        SELECT id, person_id, start_date, end_date, reason, recurring, created_at
        FROM unavailability
        WHERE person_id = $1
        ORDER BY start_date ASC
        "#,
    )
    .bind(&person_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(records))
}

// Create my unavailability (multiple dates at once)
pub async fn create_my_unavailability(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(input): Json<CreateMyUnavailability>,
) -> Result<Json<Vec<Unavailability>>, (StatusCode, String)> {
    let person_id = claims.person_id.ok_or((
        StatusCode::FORBIDDEN,
        "No tiene un servidor vinculado a su cuenta".to_string(),
    ))?;

    if input.dates.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Debe seleccionar al menos una fecha".to_string(),
        ));
    }

    let mut created: Vec<Unavailability> = Vec::new();

    for date in input.dates {
        let id = Uuid::new_v4().to_string();

        let unavailability = sqlx::query_as::<_, Unavailability>(
            r#"
            INSERT INTO unavailability (id, person_id, start_date, end_date, reason, recurring)
            VALUES ($1, $2, $3, $3, $4, false)
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(&person_id)
        .bind(&date)
        .bind(&input.reason)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        created.push(unavailability);
    }

    Ok(Json(created))
}

// Delete my unavailability (only if it belongs to me)
pub async fn delete_my_unavailability(
    State(pool): State<PgPool>,
    claims: Claims,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let person_id = claims.person_id.ok_or((
        StatusCode::FORBIDDEN,
        "No tiene un servidor vinculado a su cuenta".to_string(),
    ))?;

    // Only delete if it belongs to the authenticated user
    let result = sqlx::query("DELETE FROM unavailability WHERE id = $1 AND person_id = $2")
        .bind(&id)
        .bind(&person_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "Ausencia no encontrada o no le pertenece".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
