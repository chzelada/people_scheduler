pub mod auth;
pub mod db;
pub mod models;
pub mod routes;

use axum::Router;
use sqlx::PgPool;
use tower_http::trace::TraceLayer;

pub fn create_app(pool: PgPool) -> Router {
    routes::create_router(pool).layer(TraceLayer::new_for_http())
}

pub async fn init_database(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Run migrations
    sqlx::query(include_str!(
        "../../migrations-postgres/001_initial_schema.sql"
    ))
    .execute(pool)
    .await
    .ok(); // Ignore errors if already exists

    sqlx::query(include_str!("../../migrations-postgres/002_add_users.sql"))
        .execute(pool)
        .await
        .ok(); // Ignore errors if already exists

    sqlx::query(include_str!(
        "../../migrations-postgres/005_add_monaguillos_jr.sql"
    ))
    .execute(pool)
    .await
    .ok(); // Ignore errors if already exists

    // Migration 006: Make person_id nullable for drag-and-drop editing
    // Run each statement separately since complex SQL doesn't work well as single query
    match sqlx::query("ALTER TABLE assignments ALTER COLUMN person_id DROP NOT NULL")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 006a: person_id now nullable"),
        Err(e) => tracing::warn!("Migration 006a: {}", e),
    }

    match sqlx::query("ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_service_date_id_job_id_person_id_key")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 006b: old constraint dropped"),
        Err(e) => tracing::warn!("Migration 006b: {}", e),
    }

    // Migration 007: Add exclude_monaguillos and exclude_lectores columns
    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS exclude_monaguillos BOOLEAN NOT NULL DEFAULT FALSE")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 007a: exclude_monaguillos column added"),
        Err(e) => tracing::warn!("Migration 007a: {}", e),
    }

    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS exclude_lectores BOOLEAN NOT NULL DEFAULT FALSE")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 007b: exclude_lectores column added"),
        Err(e) => tracing::warn!("Migration 007b: {}", e),
    }

    // Migration 008: Add photo_url column for profile photos
    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS photo_url TEXT")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 008: photo_url column added"),
        Err(e) => tracing::warn!("Migration 008: {}", e),
    }

    // Migration 009: Add additional servidor fields
    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS birth_date DATE")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 009a: birth_date column added"),
        Err(e) => tracing::warn!("Migration 009a: {}", e),
    }

    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS first_communion BOOLEAN NOT NULL DEFAULT FALSE")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 009b: first_communion column added"),
        Err(e) => tracing::warn!("Migration 009b: {}", e),
    }

    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS parent_name TEXT")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 009c: parent_name column added"),
        Err(e) => tracing::warn!("Migration 009c: {}", e),
    }

    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS address TEXT")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 009d: address column added"),
        Err(e) => tracing::warn!("Migration 009d: {}", e),
    }

    match sqlx::query("ALTER TABLE people ADD COLUMN IF NOT EXISTS photo_consent BOOLEAN NOT NULL DEFAULT FALSE")
        .execute(pool)
        .await
    {
        Ok(_) => tracing::info!("Migration 009e: photo_consent column added"),
        Err(e) => tracing::warn!("Migration 009e: {}", e),
    }

    // Initialize admin user if not exists
    auth::init_admin_user(pool).await?;

    Ok(())
}
