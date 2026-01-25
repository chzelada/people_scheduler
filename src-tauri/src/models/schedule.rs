use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum ScheduleStatus {
    Draft,
    Published,
    Archived,
}

impl ScheduleStatus {
    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "DRAFT" => Self::Draft,
            "PUBLISHED" => Self::Published,
            "ARCHIVED" => Self::Archived,
            _ => Self::Draft,
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            Self::Draft => "DRAFT".to_string(),
            Self::Published => "PUBLISHED".to_string(),
            Self::Archived => "ARCHIVED".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Schedule {
    pub id: String,
    pub name: String,
    pub year: i32,
    pub month: i32,
    pub status: ScheduleStatus,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub published_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub service_dates: Vec<ServiceDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDate {
    pub id: String,
    pub schedule_id: String,
    pub service_date: NaiveDate,
    pub notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub assignments: Vec<Assignment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assignment {
    pub id: String,
    pub service_date_id: String,
    pub job_id: String,
    pub person_id: String,
    pub position: i32,
    pub manual_override: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub person_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub job_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignmentHistory {
    pub id: String,
    pub person_id: String,
    pub job_id: String,
    pub service_date: NaiveDate,
    pub year: i32,
    pub week_number: i32,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateScheduleRequest {
    pub year: i32,
    pub month: i32,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAssignmentRequest {
    pub assignment_id: String,
    pub new_person_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulePreview {
    pub schedule: Schedule,
    pub conflicts: Vec<ScheduleConflict>,
    pub fairness_scores: Vec<FairnessScore>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConflict {
    pub service_date: NaiveDate,
    pub job_id: String,
    pub conflict_type: ConflictType,
    pub message: String,
    pub affected_person_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictType {
    InsufficientPeople,
    SiblingViolation,
    ConsecutiveWeeksExceeded,
    UnavailablePerson,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobAssignmentCount {
    pub job_id: String,
    pub job_name: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FairnessScore {
    pub person_id: String,
    pub person_name: String,
    pub total_assignments: i32,
    pub assignments_this_year: i32,
    pub assignments_by_job: Vec<JobAssignmentCount>,
    pub last_assignment_date: Option<NaiveDate>,
    pub fairness_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EligiblePerson {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub is_available: bool,
    pub is_qualified: bool,
    pub passes_consecutive_check: bool,
    pub sibling_status: String, // "preferred", "neutral", "forbidden"
    pub assignments_this_year: i32,
    pub reason_if_ineligible: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetEligiblePeopleRequest {
    pub job_id: String,
    pub service_date: String,
    pub current_person_id: Option<String>,
}
