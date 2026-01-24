use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Unavailability {
    pub id: String,
    pub person_id: String,
    pub start_date: String,
    pub end_date: String,
    pub reason: Option<String>,
    pub recurring: bool,
    pub created_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub person_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUnavailabilityRequest {
    pub person_id: String,
    pub start_date: String,
    pub end_date: String,
    pub reason: Option<String>,
    pub recurring: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUnavailabilityRequest {
    pub id: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub reason: Option<String>,
    pub recurring: Option<bool>,
}
