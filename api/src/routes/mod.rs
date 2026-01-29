pub mod people;
pub mod jobs;
pub mod schedules;
pub mod unavailability;
pub mod sibling_groups;
pub mod reports;

use axum::{
    middleware,
    routing::{get, post, put, delete},
    Router,
};
use sqlx::PgPool;
use tower_http::cors::{CorsLayer, Any};

use crate::auth;

pub fn create_router(pool: PgPool) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // API routes that require authentication
    let api_routes = Router::new()
        // Auth routes (protected)
        .route("/auth/me", get(auth::me))
        .route("/auth/change-password", post(auth::change_password))

        // People routes
        .route("/people", get(people::get_all).post(people::create))
        .route("/people/{id}", get(people::get_by_id).put(people::update).delete(people::delete))
        .route("/people/{id}/reset-password", post(people::reset_password))
        .route("/people/{id}/create-user", post(people::create_user_account))

        // Jobs routes
        .route("/jobs", get(jobs::get_all))
        .route("/jobs/{id}/positions", get(jobs::get_positions))

        // Schedules routes
        .route("/schedules", get(schedules::get_all).post(schedules::generate))
        .route("/schedules/{id}", get(schedules::get_by_id).delete(schedules::delete))
        .route("/schedules/{id}/publish", post(schedules::publish))
        .route("/schedules/{id}/export", get(schedules::export_excel))
        .route("/assignments/{id}", put(schedules::update_assignment))
        .route("/assignments/{id}/clear", put(schedules::clear_assignment))
        .route("/assignments/{id}/move", put(schedules::move_assignment))
        .route("/assignments/swap", post(schedules::swap_assignments))
        .route("/schedules/{id}/completeness", get(schedules::get_schedule_completeness))
        .route("/my-assignments/{person_id}", get(schedules::get_my_assignments))

        // Unavailability routes (admin)
        .route("/unavailability", get(unavailability::get_all).post(unavailability::create))
        .route("/unavailability/{id}", delete(unavailability::delete))

        // My unavailability routes (servidor self-service)
        .route("/my-unavailability", get(unavailability::get_my_unavailability).post(unavailability::create_my_unavailability))
        .route("/my-unavailability/{id}", delete(unavailability::delete_my_unavailability))

        // Sibling groups routes
        .route("/sibling-groups", get(sibling_groups::get_all).post(sibling_groups::create))
        .route("/sibling-groups/{id}", put(sibling_groups::update).delete(sibling_groups::delete))

        // Reports routes
        .route("/reports/fairness", get(reports::get_fairness_scores))
        .route("/reports/person/{id}/history", get(reports::get_person_history))

        .route_layer(middleware::from_fn_with_state(pool.clone(), auth::auth_middleware));

    Router::new()
        // Public routes - no auth
        .route("/health", get(health_check))
        .route("/login", post(auth::login))
        // Protected API routes
        .nest("/api", api_routes)
        .with_state(pool)
        .layer(cors)
}

async fn health_check() -> &'static str {
    "OK"
}
