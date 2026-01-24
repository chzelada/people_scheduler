use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Person {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub preferred_frequency: PreferredFrequency,
    pub max_consecutive_weeks: i32,
    pub preference_level: i32,
    pub active: bool,
    pub notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub job_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum PreferredFrequency {
    Weekly,
    #[default]
    Bimonthly,
    Monthly,
}

impl PreferredFrequency {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "weekly" => Self::Weekly,
            "bimonthly" => Self::Bimonthly,
            "monthly" => Self::Monthly,
            _ => Self::Bimonthly,
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            Self::Weekly => "weekly".to_string(),
            Self::Bimonthly => "bimonthly".to_string(),
            Self::Monthly => "monthly".to_string(),
        }
    }

    pub fn days_between(&self) -> i64 {
        match self {
            Self::Weekly => 7,
            Self::Bimonthly => 14,
            Self::Monthly => 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePersonRequest {
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub preferred_frequency: Option<PreferredFrequency>,
    pub max_consecutive_weeks: Option<i32>,
    pub preference_level: Option<i32>,
    pub notes: Option<String>,
    pub job_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePersonRequest {
    pub id: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub preferred_frequency: Option<PreferredFrequency>,
    pub max_consecutive_weeks: Option<i32>,
    pub preference_level: Option<i32>,
    pub active: Option<bool>,
    pub notes: Option<String>,
    pub job_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonWithJobs {
    pub person: Person,
    pub jobs: Vec<String>,
}
