use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::Claims;
use crate::models::{Announcement, CreateAnnouncement, UpdateAnnouncement};

fn validate_data_uri(data: &str, max_bytes: usize) -> Result<(), String> {
    if !data.starts_with("data:image/") {
        return Err("Invalid data URI: must start with data:image/".to_string());
    }
    if data.len() > max_bytes {
        return Err(format!(
            "Data too large: {} bytes (max {})",
            data.len(),
            max_bytes
        ));
    }
    let valid_mimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    let mime_end = data.find(';').unwrap_or(0);
    let mime = &data[5..mime_end]; // skip "data:"
    if !valid_mimes.contains(&mime) {
        return Err(format!("Invalid image MIME type: {}", mime));
    }
    Ok(())
}

// GET /api/announcements/active - Any authenticated user
pub async fn get_active(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Announcement>>, (StatusCode, String)> {
    let today = Utc::now().date_naive();

    let announcements = sqlx::query_as::<_, Announcement>(
        "SELECT * FROM announcements WHERE publish_date <= $1 AND expires_at >= $1 ORDER BY publish_date DESC",
    )
    .bind(today)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(announcements))
}

// GET /api/announcements - Admin only
pub async fn get_all(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Announcement>>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let announcements = sqlx::query_as::<_, Announcement>(
        "SELECT * FROM announcements ORDER BY publish_date DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(announcements))
}

// POST /api/announcements - Admin only
pub async fn create(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Json(input): Json<CreateAnnouncement>,
) -> Result<(StatusCode, Json<Announcement>), (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    // Validate title
    if input.title.is_empty() || input.title.len() > 500 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Title must be between 1 and 500 characters".to_string(),
        ));
    }

    // Validate body size (max 500KB)
    if input.body.len() > 500 * 1024 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Body content too large (max 500KB)".to_string(),
        ));
    }

    // Validate dates
    if input.expires_at < input.publish_date {
        return Err((
            StatusCode::BAD_REQUEST,
            "Expiration date must be on or after publish date".to_string(),
        ));
    }

    // Validate banner photo if present
    if let Some(ref banner) = input.banner_photo {
        if !banner.is_empty() {
            validate_data_uri(banner, 400 * 1024)
                .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let announcement = sqlx::query_as::<_, Announcement>(
        "INSERT INTO announcements (id, title, body, banner_photo, publish_date, expires_at, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *",
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&input.body)
    .bind(&input.banner_photo)
    .bind(input.publish_date)
    .bind(input.expires_at)
    .bind(&claims.sub)
    .bind(now)
    .bind(now)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(announcement)))
}

// PUT /api/announcements/{id} - Admin only
pub async fn update(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
    Json(input): Json<UpdateAnnouncement>,
) -> Result<Json<Announcement>, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    // Fetch existing
    let existing = sqlx::query_as::<_, Announcement>(
        "SELECT * FROM announcements WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Announcement not found".to_string()))?;

    let title = input.title.unwrap_or(existing.title);
    let body = input.body.unwrap_or(existing.body);
    let banner_photo = if input.banner_photo.is_some() {
        input.banner_photo
    } else {
        existing.banner_photo
    };
    let publish_date = input.publish_date.unwrap_or(existing.publish_date);
    let expires_at = input.expires_at.unwrap_or(existing.expires_at);

    // Validate
    if title.is_empty() || title.len() > 500 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Title must be between 1 and 500 characters".to_string(),
        ));
    }
    if body.len() > 500 * 1024 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Body content too large (max 500KB)".to_string(),
        ));
    }
    if expires_at < publish_date {
        return Err((
            StatusCode::BAD_REQUEST,
            "Expiration date must be on or after publish date".to_string(),
        ));
    }
    if let Some(ref banner) = banner_photo {
        if !banner.is_empty() {
            validate_data_uri(banner, 400 * 1024)
                .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
        }
    }

    let now = Utc::now();

    let updated = sqlx::query_as::<_, Announcement>(
        "UPDATE announcements SET title = $1, body = $2, banner_photo = $3, publish_date = $4, expires_at = $5, updated_at = $6
         WHERE id = $7 RETURNING *",
    )
    .bind(&title)
    .bind(&body)
    .bind(&banner_photo)
    .bind(publish_date)
    .bind(expires_at)
    .bind(now)
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

// DELETE /api/announcements/{id} - Admin only
pub async fn delete(
    State(pool): State<PgPool>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    if claims.role != "admin" {
        return Err((StatusCode::FORBIDDEN, "Admin access required".to_string()));
    }

    let result = sqlx::query("DELETE FROM announcements WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Announcement not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
