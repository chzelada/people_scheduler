use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;

use crate::models::{Job, JobPosition};

pub async fn get_all(State(pool): State<PgPool>) -> Result<Json<Vec<Job>>, (StatusCode, String)> {
    let jobs = sqlx::query_as::<_, Job>("SELECT * FROM jobs WHERE active = true ORDER BY name")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(jobs))
}

pub async fn get_positions(
    State(pool): State<PgPool>,
    Path(job_id): Path<String>,
) -> Result<Json<Vec<JobPosition>>, (StatusCode, String)> {
    let positions = sqlx::query_as::<_, JobPosition>(
        "SELECT * FROM job_positions WHERE job_id = $1 ORDER BY position_number",
    )
    .bind(&job_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(positions))
}
