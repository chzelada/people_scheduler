pub mod announcements;
pub mod jobs;
pub mod people;
pub mod readings;
pub mod reports;
pub mod schedules;
pub mod sibling_groups;
pub mod unavailability;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use sqlx::PgPool;
use tower_http::cors::{Any, CorsLayer};

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
        .route(
            "/people/{id}",
            get(people::get_by_id)
                .put(people::update)
                .delete(people::delete),
        )
        .route("/people/{id}/reset-password", post(people::reset_password))
        .route(
            "/people/{id}/create-user",
            post(people::create_user_account),
        )
        .route(
            "/people/{id}/photo",
            post(people::upload_photo).delete(people::delete_photo),
        )
        .route(
            "/my-photo",
            post(people::upload_my_photo).delete(people::delete_my_photo),
        )
        // Jobs routes
        .route("/jobs", get(jobs::get_all))
        .route("/jobs/{id}/positions", get(jobs::get_positions))
        // Schedules routes
        .route(
            "/schedules",
            get(schedules::get_all).post(schedules::generate),
        )
        .route(
            "/schedules/{id}",
            get(schedules::get_by_id).delete(schedules::delete),
        )
        .route("/schedules/{id}/publish", post(schedules::publish))
        .route("/schedules/{id}/export", get(schedules::export_excel))
        .route("/assignments/{id}", put(schedules::update_assignment))
        .route("/assignments/{id}/clear", put(schedules::clear_assignment))
        .route("/assignments/{id}/move", put(schedules::move_assignment))
        .route("/assignments/swap", post(schedules::swap_assignments))
        .route(
            "/schedules/{id}/completeness",
            get(schedules::get_schedule_completeness),
        )
        .route(
            "/my-assignments/{person_id}",
            get(schedules::get_my_assignments),
        )
        .route(
            "/service-date-assignments/{date}",
            get(schedules::get_service_date_team),
        )
        .route(
            "/available-substitutes/{date}/{job_id}",
            get(schedules::get_available_substitutes),
        )
        // Unavailability routes (admin)
        .route(
            "/unavailability",
            get(unavailability::get_all).post(unavailability::create),
        )
        .route("/unavailability/{id}", delete(unavailability::delete))
        // My unavailability routes (servidor self-service)
        .route(
            "/my-unavailability",
            get(unavailability::get_my_unavailability)
                .post(unavailability::create_my_unavailability),
        )
        .route(
            "/my-unavailability/{id}",
            delete(unavailability::delete_my_unavailability),
        )
        // Sibling groups routes
        .route(
            "/sibling-groups",
            get(sibling_groups::get_all).post(sibling_groups::create),
        )
        .route(
            "/sibling-groups/{id}",
            put(sibling_groups::update).delete(sibling_groups::delete),
        )
        // Readings routes
        .route(
            "/readings/by-date/{service_date_id}",
            get(readings::get_readings_by_date),
        )
        .route(
            "/my-reading/{service_date_id}/{position}",
            get(readings::get_my_reading),
        )
        .route(
            "/readings/by-calendar-date/{date}",
            get(readings::get_readings_by_calendar_date),
        )
        .route(
            "/readings/by-date/{service_date_id}/fetch",
            post(readings::force_fetch_readings),
        )
        // Announcements routes
        .route(
            "/announcements/active",
            get(announcements::get_active),
        )
        .route(
            "/announcements",
            get(announcements::get_all).post(announcements::create),
        )
        .route(
            "/announcements/{id}",
            put(announcements::update).delete(announcements::delete),
        )
        // Reports routes
        .route("/reports/fairness", get(reports::get_fairness_scores))
        .route(
            "/reports/person/{id}/history",
            get(reports::get_person_history),
        )
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            auth::auth_middleware,
        ));

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
