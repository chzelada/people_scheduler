use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, NaiveDate, Utc};
use scraper::{Html, Selector};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::LiturgicalReading;

// ============ Parsed reading from HTML ============

#[derive(Debug, Clone)]
struct ParsedReading {
    reading_type: String,
    reference: String,
    body: String,
}

// ============ Build USCCB URL ============

fn build_usccb_url(date: NaiveDate) -> String {
    let mm = format!("{:02}", date.month());
    let dd = format!("{:02}", date.day());
    let yy = format!("{:02}", date.year() % 100);
    format!(
        "https://bible.usccb.org/es/bible/lecturas/{}{}{}.cfm",
        mm, dd, yy
    )
}

// ============ Parse USCCB HTML ============

fn parse_readings_html(html: &str) -> Vec<ParsedReading> {
    let document = Html::parse_document(html);
    let verse_selector = Selector::parse("div.b-verse").unwrap();
    let name_selector = Selector::parse("h3.name").unwrap();
    let address_selector = Selector::parse("div.address").unwrap();
    let body_selector = Selector::parse("div.content-body").unwrap();

    let mut readings = Vec::new();

    for verse_block in document.select(&verse_selector) {
        // Get the reading name (e.g. "Primera lectura", "Salmo Responsorial")
        let name = match verse_block.select(&name_selector).next() {
            Some(el) => el.text().collect::<String>().trim().to_string(),
            None => continue,
        };

        // Map to our reading_type
        let reading_type = match name.to_lowercase().as_str() {
            s if s.starts_with("primera lectura") => "primera_lectura",
            s if s.starts_with("salmo") => "salmo_responsorial",
            s if s.starts_with("segunda lectura") => "segunda_lectura",
            _ => continue, // Skip Evangelio, Aclamación, etc.
        };

        // Get the scripture reference
        let reference = match verse_block.select(&address_selector).next() {
            Some(el) => el.text().collect::<String>().trim().to_string(),
            None => continue,
        };

        // Get the body text — preserve paragraph breaks
        let body = match verse_block.select(&body_selector).next() {
            Some(el) => {
                // Get inner HTML and convert <p> and <br> tags to newlines
                let inner = el.inner_html();
                let body_doc = Html::parse_fragment(&inner);
                let p_selector = Selector::parse("p").unwrap();

                let paragraphs: Vec<String> = body_doc
                    .select(&p_selector)
                    .map(|p| {
                        // Replace <br> with newlines, collect text
                        let html = p.inner_html();
                        html.replace("<br>", "\n")
                            .replace("<br/>", "\n")
                            .replace("<br />", "\n")
                    })
                    .collect();

                if paragraphs.is_empty() {
                    // Fallback: just collect all text
                    el.text().collect::<String>().trim().to_string()
                } else {
                    // Strip remaining HTML tags from each paragraph
                    paragraphs
                        .iter()
                        .map(|p| {
                            let frag = Html::parse_fragment(p);
                            frag.root_element().text().collect::<String>()
                        })
                        .collect::<Vec<_>>()
                        .join("\n\n")
                        .trim()
                        .to_string()
                }
            }
            None => continue,
        };

        if !reference.is_empty() && !body.is_empty() {
            readings.push(ParsedReading {
                reading_type: reading_type.to_string(),
                reference,
                body,
            });
        }
    }

    readings
}

// ============ Fetch and Store Readings ============

pub async fn fetch_and_store_readings(
    pool: &PgPool,
    service_date_id: &str,
    date: NaiveDate,
) -> Result<Vec<LiturgicalReading>, String> {
    let url = build_usccb_url(date);

    // Fetch the page
    let html = reqwest::get(&url)
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Parse readings
    let parsed = parse_readings_html(&html);
    if parsed.is_empty() {
        return Err("No readings found in USCCB page".to_string());
    }

    let mut stored = Vec::new();

    for reading in parsed {
        let id = Uuid::new_v4().to_string();
        let result = sqlx::query_as::<_, LiturgicalReading>(
            r#"
            INSERT INTO liturgical_readings (id, service_date_id, reading_type, reference, body, source_url, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days')
            ON CONFLICT (service_date_id, reading_type)
            DO UPDATE SET reference = EXCLUDED.reference, body = EXCLUDED.body,
                          source_url = EXCLUDED.source_url, fetched_at = NOW(), updated_at = NOW(),
                          expires_at = NOW() + INTERVAL '7 days'
            RETURNING *
            "#,
        )
        .bind(&id)
        .bind(service_date_id)
        .bind(&reading.reading_type)
        .bind(&reading.reference)
        .bind(&reading.body)
        .bind(&url)
        .fetch_one(pool)
        .await
        .map_err(|e| format!("DB insert failed: {}", e))?;

        stored.push(result);
    }

    Ok(stored)
}

// ============ GET /api/readings/by-date/{service_date_id} ============

pub async fn get_readings_by_date(
    State(pool): State<PgPool>,
    Path(service_date_id): Path<String>,
) -> Result<Json<Vec<LiturgicalReading>>, (StatusCode, String)> {
    // Try to get from DB first
    let readings = sqlx::query_as::<_, LiturgicalReading>(
        "SELECT * FROM liturgical_readings WHERE service_date_id = $1 ORDER BY reading_type",
    )
    .bind(&service_date_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Check if cached and not expired
    let expired = readings
        .first()
        .and_then(|r| r.expires_at)
        .map(|exp| exp < Utc::now())
        .unwrap_or(false);

    if !readings.is_empty() && !expired {
        return Ok(Json(readings));
    }

    // Lazy fetch (missing or expired): get the service date to know the actual date
    let date = sqlx::query_scalar::<_, NaiveDate>(
        "SELECT service_date FROM service_dates WHERE id = $1",
    )
    .bind(&service_date_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Service date not found".to_string()))?;

    // Fetch from USCCB
    match fetch_and_store_readings(&pool, &service_date_id, date).await {
        Ok(fresh) => Ok(Json(fresh)),
        Err(e) => {
            tracing::warn!("Failed to fetch readings for {}: {}", date, e);
            // Return stale data if available, otherwise empty
            Ok(Json(readings))
        }
    }
}

// ============ Response for my-reading endpoint ============

#[derive(Debug, Clone, serde::Serialize)]
pub struct MyReadingResponse {
    pub reading_type: String,
    pub reference: String,
    pub body: String,
    pub source_url: Option<String>,
}

// ============ GET /api/my-reading/{service_date_id}/{position} ============

pub async fn get_my_reading(
    State(pool): State<PgPool>,
    Path((service_date_id, position)): Path<(String, String)>,
) -> Result<Json<Option<MyReadingResponse>>, (StatusCode, String)> {
    // Map position name to reading type
    let reading_type = match position.to_lowercase().as_str() {
        s if s.starts_with("primera") => "primera_lectura",
        s if s.starts_with("salmo") => "salmo_responsorial",
        s if s.starts_with("segunda") => "segunda_lectura",
        _ => return Ok(Json(None)), // Monitor or unknown position
    };

    // Try DB first
    let cached = sqlx::query_as::<_, LiturgicalReading>(
        "SELECT * FROM liturgical_readings WHERE service_date_id = $1 AND reading_type = $2",
    )
    .bind(&service_date_id)
    .bind(reading_type)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let expired = cached
        .as_ref()
        .and_then(|r| r.expires_at)
        .map(|exp| exp < Utc::now())
        .unwrap_or(false);

    if let Some(r) = cached.as_ref() {
        if !expired {
            return Ok(Json(Some(MyReadingResponse {
                reading_type: r.reading_type.clone(),
                reference: r.reference.clone(),
                body: r.body.clone(),
                source_url: r.source_url.clone(),
            })));
        }
    }

    // Lazy fetch (missing or expired): get the actual date
    let date = sqlx::query_scalar::<_, NaiveDate>(
        "SELECT service_date FROM service_dates WHERE id = $1",
    )
    .bind(&service_date_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Service date not found".to_string()))?;

    // Fetch all readings for this date
    match fetch_and_store_readings(&pool, &service_date_id, date).await {
        Ok(readings) => {
            let found = readings.into_iter().find(|r| r.reading_type == reading_type);
            Ok(Json(found.map(|r| MyReadingResponse {
                reading_type: r.reading_type,
                reference: r.reference,
                body: r.body,
                source_url: r.source_url,
            })))
        }
        Err(e) => {
            tracing::warn!("Failed to fetch readings for {}: {}", date, e);
            // Return stale data if available
            Ok(Json(cached.map(|r| MyReadingResponse {
                reading_type: r.reading_type,
                reference: r.reference,
                body: r.body,
                source_url: r.source_url,
            })))
        }
    }
}

// ============ GET /api/readings/by-calendar-date/{date} ============
// Takes yyyy-MM-dd, finds service_date row, returns all readings (any servidor can use)

pub async fn get_readings_by_calendar_date(
    State(pool): State<PgPool>,
    Path(date_str): Path<String>,
) -> Result<Json<Vec<LiturgicalReading>>, (StatusCode, String)> {
    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid date format, use yyyy-MM-dd".to_string()))?;

    // Find a service_date row for this calendar date (from any schedule)
    let row = sqlx::query_as::<_, (String,)>(
        "SELECT id FROM service_dates WHERE service_date = $1 LIMIT 1",
    )
    .bind(date)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let service_date_id = match row {
        Some((id,)) => id,
        None => {
            // No service_date in DB — return empty
            return Ok(Json(vec![]));
        }
    };

    // Check cache
    let readings = sqlx::query_as::<_, LiturgicalReading>(
        "SELECT * FROM liturgical_readings WHERE service_date_id = $1 ORDER BY reading_type",
    )
    .bind(&service_date_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let expired = readings
        .first()
        .and_then(|r| r.expires_at)
        .map(|exp| exp < Utc::now())
        .unwrap_or(false);

    if !readings.is_empty() && !expired {
        return Ok(Json(readings));
    }

    // Fetch from USCCB
    match fetch_and_store_readings(&pool, &service_date_id, date).await {
        Ok(fresh) => Ok(Json(fresh)),
        Err(e) => {
            tracing::warn!("Failed to fetch readings for {}: {}", date, e);
            Ok(Json(readings))
        }
    }
}

// ============ POST /api/readings/by-date/{service_date_id}/fetch ============

pub async fn force_fetch_readings(
    State(pool): State<PgPool>,
    Path(service_date_id): Path<String>,
) -> Result<Json<Vec<LiturgicalReading>>, (StatusCode, String)> {
    let date = sqlx::query_scalar::<_, NaiveDate>(
        "SELECT service_date FROM service_dates WHERE id = $1",
    )
    .bind(&service_date_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Service date not found".to_string()))?;

    match fetch_and_store_readings(&pool, &service_date_id, date).await {
        Ok(readings) => Ok(Json(readings)),
        Err(e) => Err((StatusCode::BAD_GATEWAY, e)),
    }
}

// ============ Background fetch for all service dates in a schedule ============

pub async fn fetch_readings_for_schedule(pool: PgPool, schedule_id: String) {
    // Get all service dates for this schedule
    let service_dates = match sqlx::query_as::<_, (String, NaiveDate)>(
        "SELECT id, service_date FROM service_dates WHERE schedule_id = $1",
    )
    .bind(&schedule_id)
    .fetch_all(&pool)
    .await
    {
        Ok(dates) => dates,
        Err(e) => {
            tracing::error!("Failed to get service dates for readings fetch: {}", e);
            return;
        }
    };

    for (sd_id, date) in service_dates {
        match fetch_and_store_readings(&pool, &sd_id, date).await {
            Ok(readings) => {
                tracing::info!(
                    "Fetched {} readings for {} ({})",
                    readings.len(),
                    date,
                    sd_id
                );
            }
            Err(e) => {
                tracing::warn!("Failed to fetch readings for {}: {}", date, e);
            }
        }
    }
}
