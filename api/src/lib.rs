pub mod auth;
pub mod db;
pub mod models;
pub mod routes;

use axum::Router;
use sqlx::PgPool;
use tower_http::trace::TraceLayer;

pub fn create_app(pool: PgPool) -> Router {
    routes::create_router(pool)
        .layer(TraceLayer::new_for_http())
}

pub async fn init_database(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Run migrations
    sqlx::query(include_str!("../../migrations-postgres/001_initial_schema.sql"))
        .execute(pool)
        .await
        .ok(); // Ignore errors if already exists

    sqlx::query(include_str!("../../migrations-postgres/002_add_users.sql"))
        .execute(pool)
        .await
        .ok(); // Ignore errors if already exists

    // Initialize admin user if not exists
    auth::init_admin_user(pool).await?;

    Ok(())
}
