use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum PairingRule {
    Together,
    Separate,
}

impl PairingRule {
    pub fn from_str(s: &str) -> Self {
        match s.to_uppercase().as_str() {
            "TOGETHER" => Self::Together,
            "SEPARATE" => Self::Separate,
            _ => Self::Together,
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            Self::Together => "TOGETHER".to_string(),
            Self::Separate => "SEPARATE".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiblingGroup {
    pub id: String,
    pub name: String,
    pub pairing_rule: PairingRule,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub member_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiblingGroupMember {
    pub id: String,
    pub sibling_group_id: String,
    pub person_id: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSiblingGroupRequest {
    pub name: String,
    pub pairing_rule: PairingRule,
    pub member_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSiblingGroupRequest {
    pub id: String,
    pub name: Option<String>,
    pub pairing_rule: Option<PairingRule>,
    pub member_ids: Option<Vec<String>>,
}
