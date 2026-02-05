//! Local development server for People Scheduler API
//!
//! Run with: cargo run --bin api
//! Or: cargo watch -x 'run --bin api'

use dotenvy::dotenv;
use people_scheduler_api::{create_app, db, init_database};
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // Load .env file
    dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .init();

    // Create database pool
    let pool = db::create_pool()
        .await
        .expect("Failed to create database pool");

    tracing::info!("Connected to database");

    // Run migrations
    init_database(&pool)
        .await
        .expect("Failed to initialize database");
    tracing::info!("Database initialized");

    // Create app
    let app = create_app(pool);

    // Run server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
