//! AWS Lambda handler for People Scheduler API
//!
//! Build with: cargo lambda build --release
//! Deploy with: cargo lambda deploy

use lambda_http::{run, Error};
use people_scheduler_api::{create_app, db, init_database};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing for Lambda
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().without_time())
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .init();

    // Create database pool
    let pool = db::create_pool()
        .await
        .expect("Failed to create database pool");

    tracing::info!("Connected to database");

    // Initialize database (run migrations and create admin user)
    init_database(&pool)
        .await
        .expect("Failed to initialize database");

    // Create app
    let app = create_app(pool);

    // Run Lambda
    run(app).await
}
