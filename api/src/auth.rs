use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

// JWT secret - in production, use environment variable
fn get_jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "people-scheduler-secret-key-change-in-production".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,      // user id
    pub username: String,
    pub role: String,
    pub person_id: Option<String>,  // linked person for servidores
    pub exp: i64,         // expiration time
    pub iat: i64,         // issued at
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub username: String,
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub person_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, sqlx::FromRow)]
pub struct User {
    pub id: uuid::Uuid,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub person_id: Option<String>,
}

// Hash a password using Argon2
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(password_hash.to_string())
}

// Verify a password against a hash
pub fn verify_password(password: &str, password_hash: &str) -> bool {
    let parsed_hash = match PasswordHash::new(password_hash) {
        Ok(hash) => hash,
        Err(_) => return false,
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

// Generate a JWT token
pub fn generate_token(user: &User) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = now + Duration::hours(24);

    let claims = Claims {
        sub: user.id.to_string(),
        username: user.username.clone(),
        role: user.role.clone(),
        person_id: user.person_id.clone(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(get_jwt_secret().as_bytes()),
    )
}

// Validate a JWT token
pub fn validate_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(get_jwt_secret().as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims)
}

// Login endpoint
pub async fn login(
    State(pool): State<PgPool>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, String)> {
    // Find user by username
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, role, person_id FROM users WHERE username = $1"
    )
    .bind(&request.username)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = match user {
        Some(u) => u,
        None => return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())),
    };

    // Verify password
    if !verify_password(&request.password, &user.password_hash) {
        return Err((StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()));
    }

    // Generate token
    let token = generate_token(&user)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(LoginResponse {
        token,
        username: user.username,
        role: user.role,
        person_id: user.person_id,
    }))
}

// Change password endpoint
pub async fn change_password(
    State(pool): State<PgPool>,
    claims: Claims,
    Json(request): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Get current user
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password_hash, role, person_id FROM users WHERE id = $1"
    )
    .bind(uuid::Uuid::parse_str(&claims.sub).unwrap())
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user = match user {
        Some(u) => u,
        None => return Err((StatusCode::NOT_FOUND, "User not found".to_string())),
    };

    // Verify current password
    if !verify_password(&request.current_password, &user.password_hash) {
        return Err((StatusCode::UNAUTHORIZED, "Current password is incorrect".to_string()));
    }

    // Validate new password
    if request.new_password.len() < 6 {
        return Err((StatusCode::BAD_REQUEST, "New password must be at least 6 characters".to_string()));
    }

    // Hash new password
    let new_hash = hash_password(&request.new_password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update password
    sqlx::query("UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2")
        .bind(&new_hash)
        .bind(user.id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "message": "Password changed successfully" })))
}

// Get current user info
pub async fn me(claims: Claims) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "id": claims.sub,
        "username": claims.username,
        "role": claims.role
    }))
}

// Auth middleware - extracts and validates JWT from Authorization header
pub async fn auth_middleware(
    State(_pool): State<PgPool>,
    mut request: Request,
    next: Next,
) -> Response {
    // Get authorization header
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return (StatusCode::UNAUTHORIZED, "Missing or invalid authorization header").into_response();
        }
    };

    // Validate token
    let claims = match validate_token(token) {
        Ok(claims) => claims,
        Err(_) => {
            return (StatusCode::UNAUTHORIZED, "Invalid or expired token").into_response();
        }
    };

    // Add claims to request extensions
    request.extensions_mut().insert(claims);

    next.run(request).await
}

// Extractor for Claims from request extensions
use axum::extract::FromRequestParts;
use axum::http::request::Parts;

impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<Claims>()
            .cloned()
            .ok_or((StatusCode::UNAUTHORIZED, "Not authenticated"))
    }
}

// Initialize admin user if not exists
pub async fn init_admin_user(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Check if admin user exists
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = 'admin')"
    )
    .fetch_one(pool)
    .await?;

    if !exists {
        let password_hash = hash_password("admin123").expect("Failed to hash password");
        sqlx::query(
            "INSERT INTO users (username, password_hash, role) VALUES ('admin', $1, 'admin')"
        )
        .bind(&password_hash)
        .execute(pool)
        .await?;
        tracing::info!("Created default admin user (username: admin, password: admin123)");
    }

    Ok(())
}
