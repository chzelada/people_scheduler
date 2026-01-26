use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

// ============ Jobs ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Job {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub people_required: i32,
    pub color: Option<String>,
    pub active: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct JobPosition {
    pub id: String,
    pub job_id: String,
    pub position_number: i32,
    pub name: String,
    pub created_at: Option<DateTime<Utc>>,
}

// ============ People ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Person {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub preferred_frequency: Option<String>,
    pub max_consecutive_weeks: Option<i32>,
    pub preference_level: Option<i32>,
    pub active: bool,
    pub notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonWithJobs {
    #[serde(flatten)]
    pub person: Person,
    pub job_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonWithCredentials {
    #[serde(flatten)]
    pub person: Person,
    pub job_ids: Vec<String>,
    pub username: String,
    pub generated_password: String, // Only returned once when creating or resetting
}

#[derive(Debug, Deserialize)]
pub struct CreatePerson {
    pub first_name: String,
    pub last_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub preferred_frequency: Option<String>,
    pub max_consecutive_weeks: Option<i32>,
    pub preference_level: Option<i32>,
    pub notes: Option<String>,
    pub job_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePerson {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub preferred_frequency: Option<String>,
    pub max_consecutive_weeks: Option<i32>,
    pub preference_level: Option<i32>,
    pub active: Option<bool>,
    pub notes: Option<String>,
    pub job_ids: Option<Vec<String>>,
}

// ============ Person Jobs ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PersonJob {
    pub id: String,
    pub person_id: String,
    pub job_id: String,
    pub proficiency_level: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}

// ============ Sibling Groups ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SiblingGroup {
    pub id: String,
    pub name: String,
    pub pairing_rule: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiblingGroupWithMembers {
    #[serde(flatten)]
    pub group: SiblingGroup,
    pub member_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSiblingGroup {
    pub name: String,
    pub pairing_rule: String,
    pub member_ids: Vec<String>,
}

// ============ Unavailability ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Unavailability {
    pub id: String,
    pub person_id: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
    pub recurring: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnavailabilityWithPerson {
    #[serde(flatten)]
    pub unavailability: Unavailability,
    pub person_name: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateUnavailability {
    pub person_id: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
    pub recurring: Option<bool>,
}

// ============ Schedules ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Schedule {
    pub id: String,
    pub name: String,
    pub year: i32,
    pub month: i32,
    pub status: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ServiceDate {
    pub id: String,
    pub schedule_id: String,
    pub service_date: NaiveDate,
    pub notes: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Assignment {
    pub id: String,
    pub service_date_id: String,
    pub job_id: String,
    pub person_id: String,
    pub position: Option<i32>,
    pub position_name: Option<String>,
    pub manual_override: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignmentWithDetails {
    #[serde(flatten)]
    pub assignment: Assignment,
    pub person_name: String,
    pub job_name: String,
}

#[derive(Debug, Deserialize)]
pub struct GenerateScheduleRequest {
    pub year: i32,
    pub month: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAssignmentRequest {
    pub person_id: String,
}

// ============ Assignment History ============

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssignmentHistory {
    pub id: String,
    pub person_id: String,
    pub job_id: String,
    pub service_date: NaiveDate,
    pub year: i32,
    pub week_number: i32,
    pub position: Option<i32>,
    pub created_at: Option<DateTime<Utc>>,
}

// ============ Reports ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobAssignmentCount {
    pub job_name: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FairnessScore {
    pub person_id: String,
    pub person_name: String,
    pub assignments_this_year: i64,
    pub last_assignment_date: Option<NaiveDate>,
    pub assignments_by_job: Vec<JobAssignmentCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonHistoryEntry {
    pub service_date: NaiveDate,
    pub job_id: String,
    pub job_name: String,
    pub position: Option<i32>,
    pub position_name: Option<String>,
}

// ============ Schedule with full details ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleWithDates {
    #[serde(flatten)]
    pub schedule: Schedule,
    pub service_dates: Vec<ServiceDateWithAssignments>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDateWithAssignments {
    #[serde(flatten)]
    pub service_date: ServiceDate,
    pub assignments: Vec<AssignmentWithDetails>,
}
