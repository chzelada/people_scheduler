use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{hash_password, Claims};
use crate::models::{CreatePerson, Person, PersonWithCredentials, PersonWithJobs, UpdatePerson, UploadPhotoRequest};

// Generate a random password (8 characters, alphanumeric)
fn generate_random_password() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let mut rng = rand::thread_rng();
    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

// Generate username from first name and last name
// Format: first letter of first name + last name (lowercase, no spaces/accents)
// If taken, try first two letters + last name, then add numbers
async fn generate_username(
    pool: &PgPool,
    first_name: &str,
    last_name: &str,
) -> Result<String, (StatusCode, String)> {
    // Normalize: remove accents, lowercase, remove spaces
    let first_normalized = normalize_name(first_name);
    let last_normalized = normalize_name(last_name);

    if first_normalized.is_empty() || last_normalized.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid name for username generation".to_string(),
        ));
    }

    // Try: first letter + last name
    let base_username = format!(
        "{}{}",
        first_normalized.chars().next().unwrap(),
        last_normalized
    );

    if !username_exists(pool, &base_username).await? {
        return Ok(base_username);
    }

    // Try: first two letters + last name
    if first_normalized.len() >= 2 {
        let username_two = format!("{}{}", &first_normalized[..2], last_normalized);
        if !username_exists(pool, &username_two).await? {
            return Ok(username_two);
        }
    }

    // Add numbers until we find one that works
    for i in 1..=99 {
        let username_numbered = format!("{}{}", base_username, i);
        if !username_exists(pool, &username_numbered).await? {
            return Ok(username_numbered);
        }
    }

    Err((
        StatusCode::CONFLICT,
        "Could not generate unique username".to_string(),
    ))
}

// Check if username exists in users table
async fn username_exists(pool: &PgPool, username: &str) -> Result<bool, (StatusCode, String)> {
    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)")
            .bind(username)
            .fetch_one(pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(exists)
}

// Normalize name for username generation (remove accents, lowercase)
fn normalize_name(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric())
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' | 'Á' | 'À' | 'Ä' | 'Â' => 'a',
            'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'Ó' | 'Ò' | 'Ö' | 'Ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => 'u',
            'ñ' | 'Ñ' => 'n',
            _ => c.to_ascii_lowercase(),
        })
        .collect()
}

// Get username for a person (from linked user)
async fn get_username_for_person(
    pool: &PgPool,
    person_id: &str,
) -> Result<Option<String>, (StatusCode, String)> {
    let username =
        sqlx::query_scalar::<_, String>("SELECT username FROM users WHERE person_id = $1")
            .bind(person_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(username)
}

pub async fn get_all(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<PersonWithJobs>>, (StatusCode, String)> {
    let people = sqlx::query_as::<_, Person>(
        r#"SELECT id, first_name, last_name, email, phone, preferred_frequency,
                  max_consecutive_weeks, preference_level, active, notes,
                  created_at, updated_at, exclude_monaguillos, exclude_lectores, photo_url
           FROM people ORDER BY last_name, first_name"#
    )
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result = Vec::new();
    for person in people {
        let job_ids: Vec<String> =
            sqlx::query_scalar("SELECT job_id FROM person_jobs WHERE person_id = $1")
                .bind(&person.id)
                .fetch_all(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let username = get_username_for_person(&pool, &person.id).await?;

        result.push(PersonWithJobs {
            person,
            job_ids,
            username,
        });
    }

    Ok(Json(result))
}

pub async fn get_by_id(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<Json<PersonWithJobs>, (StatusCode, String)> {
    let person = sqlx::query_as::<_, Person>(
        r#"SELECT id, first_name, last_name, email, phone, preferred_frequency,
                  max_consecutive_weeks, preference_level, active, notes,
                  created_at, updated_at, exclude_monaguillos, exclude_lectores, photo_url
           FROM people WHERE id = $1"#
    )
        .bind(&id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Person not found".to_string()))?;

    let job_ids: Vec<String> =
        sqlx::query_scalar("SELECT job_id FROM person_jobs WHERE person_id = $1")
            .bind(&id)
            .fetch_all(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let username = get_username_for_person(&pool, &id).await?;

    Ok(Json(PersonWithJobs {
        person,
        job_ids,
        username,
    }))
}

pub async fn create(
    State(pool): State<PgPool>,
    Json(input): Json<CreatePerson>,
) -> Result<Json<PersonWithCredentials>, (StatusCode, String)> {
    let id = Uuid::new_v4().to_string();

    let person = sqlx::query_as::<_, Person>(
        r#"
        INSERT INTO people (id, first_name, last_name, email, phone, preferred_frequency, max_consecutive_weeks, preference_level, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        "#
    )
    .bind(&id)
    .bind(&input.first_name)
    .bind(&input.last_name)
    .bind(&input.email)
    .bind(&input.phone)
    .bind(&input.preferred_frequency)
    .bind(&input.max_consecutive_weeks)
    .bind(&input.preference_level)
    .bind(&input.notes)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Insert person_jobs
    for job_id in &input.job_ids {
        let pj_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO person_jobs (id, person_id, job_id) VALUES ($1, $2, $3)")
            .bind(&pj_id)
            .bind(&id)
            .bind(job_id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Generate username and password for servidor login
    let username = generate_username(&pool, &input.first_name, &input.last_name).await?;
    let generated_password = generate_random_password();
    let password_hash = hash_password(&generated_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create linked user with role 'servidor'
    sqlx::query(
        "INSERT INTO users (username, password_hash, role, person_id) VALUES ($1, $2, 'servidor', $3)"
    )
    .bind(&username)
    .bind(&password_hash)
    .bind(&id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(PersonWithCredentials {
        person,
        job_ids: input.job_ids,
        username,
        generated_password,
    }))
}

pub async fn update(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    Json(input): Json<UpdatePerson>,
) -> Result<Json<PersonWithJobs>, (StatusCode, String)> {
    // Build dynamic update query
    let mut updates = Vec::new();
    let mut param_count = 1;

    if input.first_name.is_some() {
        updates.push(format!("first_name = ${}", param_count));
        param_count += 1;
    }
    if input.last_name.is_some() {
        updates.push(format!("last_name = ${}", param_count));
        param_count += 1;
    }
    if input.email.is_some() {
        updates.push(format!("email = ${}", param_count));
        param_count += 1;
    }
    if input.phone.is_some() {
        updates.push(format!("phone = ${}", param_count));
        param_count += 1;
    }
    if input.preferred_frequency.is_some() {
        updates.push(format!("preferred_frequency = ${}", param_count));
        param_count += 1;
    }
    if input.max_consecutive_weeks.is_some() {
        updates.push(format!("max_consecutive_weeks = ${}", param_count));
        param_count += 1;
    }
    if input.preference_level.is_some() {
        updates.push(format!("preference_level = ${}", param_count));
        param_count += 1;
    }
    if input.active.is_some() {
        updates.push(format!("active = ${}", param_count));
        param_count += 1;
    }
    if input.notes.is_some() {
        updates.push(format!("notes = ${}", param_count));
        param_count += 1;
    }
    if input.exclude_monaguillos.is_some() {
        updates.push(format!("exclude_monaguillos = ${}", param_count));
        param_count += 1;
    }
    if input.exclude_lectores.is_some() {
        updates.push(format!("exclude_lectores = ${}", param_count));
        param_count += 1;
    }

    if !updates.is_empty() {
        let query = format!(
            "UPDATE people SET {} WHERE id = ${} RETURNING *",
            updates.join(", "),
            param_count
        );

        let mut q = sqlx::query_as::<_, Person>(&query);

        if let Some(ref v) = input.first_name {
            q = q.bind(v);
        }
        if let Some(ref v) = input.last_name {
            q = q.bind(v);
        }
        if let Some(ref v) = input.email {
            q = q.bind(v);
        }
        if let Some(ref v) = input.phone {
            q = q.bind(v);
        }
        if let Some(ref v) = input.preferred_frequency {
            q = q.bind(v);
        }
        if let Some(ref v) = input.max_consecutive_weeks {
            q = q.bind(v);
        }
        if let Some(ref v) = input.preference_level {
            q = q.bind(v);
        }
        if let Some(ref v) = input.active {
            q = q.bind(v);
        }
        if let Some(ref v) = input.notes {
            q = q.bind(v);
        }
        if let Some(ref v) = input.exclude_monaguillos {
            q = q.bind(v);
        }
        if let Some(ref v) = input.exclude_lectores {
            q = q.bind(v);
        }
        q = q.bind(&id);

        q.fetch_one(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Update job_ids if provided
    if let Some(job_ids) = &input.job_ids {
        // Delete existing
        sqlx::query("DELETE FROM person_jobs WHERE person_id = $1")
            .bind(&id)
            .execute(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Insert new
        for job_id in job_ids {
            let pj_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO person_jobs (id, person_id, job_id) VALUES ($1, $2, $3)")
                .bind(&pj_id)
                .bind(&id)
                .bind(job_id)
                .execute(&pool)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    // Return updated person
    get_by_id(State(pool), Path(id)).await
}

pub async fn delete(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Delete linked user first (cascade should handle this but be explicit)
    sqlx::query("DELETE FROM users WHERE person_id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = sqlx::query("DELETE FROM people WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Person not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// Create user account for an existing person (servidor) who doesn't have one
pub async fn create_user_account(
    State(pool): State<PgPool>,
    Path(person_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Check person exists
    let person = sqlx::query_as::<_, Person>(
        r#"SELECT id, first_name, last_name, email, phone, preferred_frequency,
                  max_consecutive_weeks, preference_level, active, notes,
                  created_at, updated_at, exclude_monaguillos, exclude_lectores, photo_url
           FROM people WHERE id = $1"#
    )
        .bind(&person_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Person not found".to_string()))?;

    // Check if user account already exists
    let existing_user =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE person_id = $1)")
            .bind(&person_id)
            .fetch_one(&pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing_user {
        return Err((
            StatusCode::CONFLICT,
            "User account already exists for this person".to_string(),
        ));
    }

    // Generate username and password
    let username = generate_username(&pool, &person.first_name, &person.last_name).await?;
    let generated_password = generate_random_password();
    let password_hash = hash_password(&generated_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Create linked user with role 'servidor'
    sqlx::query(
        "INSERT INTO users (username, password_hash, role, person_id) VALUES ($1, $2, 'servidor', $3)"
    )
    .bind(&username)
    .bind(&password_hash)
    .bind(&person_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({
        "username": username,
        "password": generated_password
    })))
}

// Reset password for a servidor - returns the new password once
pub async fn reset_password(
    State(pool): State<PgPool>,
    Path(person_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Check person exists
    let exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM people WHERE id = $1)")
        .bind(&person_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Person not found".to_string()));
    }

    // Generate new password
    let new_password = generate_random_password();
    let password_hash = hash_password(&new_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update user's password
    let result = sqlx::query(
        "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE person_id = $2",
    )
    .bind(&password_hash)
    .bind(&person_id)
    .execute(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            "User not found for this person".to_string(),
        ));
    }

    Ok(Json(serde_json::json!({
        "message": "Password reset successfully",
        "new_password": new_password
    })))
}

// Validate photo data URI
fn validate_photo_data(photo_data: &str) -> Result<(), (StatusCode, String)> {
    // Check format: data:image/TYPE;base64,DATA
    if !photo_data.starts_with("data:image/") {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid photo format. Must be a data URI".to_string(),
        ));
    }

    // Extract MIME type
    let mime_end = photo_data.find(';').ok_or((
        StatusCode::BAD_REQUEST,
        "Invalid data URI format".to_string(),
    ))?;
    let mime_type = &photo_data[5..mime_end]; // Skip "data:"

    // Only allow jpeg, png, webp
    let allowed_types = ["image/jpeg", "image/png", "image/webp"];
    if !allowed_types.contains(&mime_type) {
        return Err((
            StatusCode::BAD_REQUEST,
            format!("Invalid image type: {}. Allowed: jpeg, png, webp", mime_type),
        ));
    }

    // Check size (100KB limit for base64 data)
    // Base64 encoding increases size by ~33%, so 100KB binary = ~137KB base64
    const MAX_SIZE: usize = 150_000; // ~100KB after decoding
    if photo_data.len() > MAX_SIZE {
        return Err((
            StatusCode::BAD_REQUEST,
            "Photo too large. Maximum size is 100KB".to_string(),
        ));
    }

    Ok(())
}

// Admin: Upload photo for any person
pub async fn upload_photo(
    State(pool): State<PgPool>,
    Path(person_id): Path<String>,
    Json(input): Json<UploadPhotoRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Validate photo data
    validate_photo_data(&input.photo_data)?;

    // Check person exists
    let exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM people WHERE id = $1)")
        .bind(&person_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Person not found".to_string()));
    }

    // Update photo
    sqlx::query("UPDATE people SET photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2")
        .bind(&input.photo_data)
        .bind(&person_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "message": "Photo uploaded successfully" })))
}

// Admin: Delete photo for any person
pub async fn delete_photo(
    State(pool): State<PgPool>,
    Path(person_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Check person exists
    let exists = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM people WHERE id = $1)")
        .bind(&person_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !exists {
        return Err((StatusCode::NOT_FOUND, "Person not found".to_string()));
    }

    // Clear photo
    sqlx::query("UPDATE people SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(&person_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "message": "Photo deleted successfully" })))
}

// Servidor: Upload own photo
pub async fn upload_my_photo(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(input): Json<UploadPhotoRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Get person_id from claims
    let person_id = claims.person_id.ok_or((
        StatusCode::FORBIDDEN,
        "No linked person account".to_string(),
    ))?;

    // Validate photo data
    validate_photo_data(&input.photo_data)?;

    // Update photo
    sqlx::query("UPDATE people SET photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2")
        .bind(&input.photo_data)
        .bind(&person_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "message": "Photo uploaded successfully" })))
}

// Servidor: Delete own photo
pub async fn delete_my_photo(
    State(pool): State<PgPool>,
    claims: Claims,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Get person_id from claims
    let person_id = claims.person_id.ok_or((
        StatusCode::FORBIDDEN,
        "No linked person account".to_string(),
    ))?;

    // Clear photo
    sqlx::query("UPDATE people SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1")
        .bind(&person_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "message": "Photo deleted successfully" })))
}
