use chrono::{Datelike, NaiveDate};

use crate::models::{PairingRule, Person, SiblingGroup};

/// Checks if a person is available on a given date
pub fn is_available(person_id: &str, date: NaiveDate, unavailable_dates: &[(String, NaiveDate, NaiveDate)]) -> bool {
    !unavailable_dates.iter().any(|(pid, start, end)| {
        pid == person_id && date >= *start && date <= *end
    })
}

/// Checks if assigning a person would violate sibling pairing rules
pub fn check_sibling_constraint(
    person_id: &str,
    already_assigned: &[String],
    sibling_groups: &[SiblingGroup],
) -> SiblingConstraintResult {
    for group in sibling_groups {
        if !group.member_ids.contains(&person_id.to_string()) {
            continue;
        }

        let siblings_assigned: Vec<&String> = group
            .member_ids
            .iter()
            .filter(|id| already_assigned.contains(id))
            .collect();

        match group.pairing_rule {
            PairingRule::Together => {
                // If any sibling is already assigned, prefer adding more siblings
                if !siblings_assigned.is_empty() && !siblings_assigned.contains(&&person_id.to_string()) {
                    return SiblingConstraintResult::Preferred;
                }
            }
            PairingRule::Separate => {
                // If any sibling is assigned, this person should not be assigned
                if !siblings_assigned.is_empty() {
                    return SiblingConstraintResult::Forbidden;
                }
            }
        }
    }

    SiblingConstraintResult::Neutral
}

#[derive(Debug, Clone, PartialEq)]
pub enum SiblingConstraintResult {
    Preferred,  // Should prioritize this person
    Neutral,    // No preference
    Forbidden,  // Should not assign this person
}

/// Checks if assigning would exceed max consecutive weeks
pub fn check_consecutive_weeks(
    person: &Person,
    date: NaiveDate,
    recent_assignments: &[(String, NaiveDate)],
) -> bool {
    let week = date.iso_week().week();
    let year = date.iso_week().year();

    let mut consecutive = 0;
    for i in 1..=person.max_consecutive_weeks as u32 {
        let check_week = if week > i { week - i } else { 52 + week - i };
        let check_year = if week > i { year } else { year - 1 };

        let was_assigned = recent_assignments.iter().any(|(pid, d)| {
            pid == &person.id && d.iso_week().week() == check_week && d.iso_week().year() == check_year
        });

        if was_assigned {
            consecutive += 1;
        } else {
            break;
        }
    }

    consecutive < person.max_consecutive_weeks as u32
}

/// Calculate fairness score for a person (higher = more priority)
pub fn calculate_fairness_score(
    person: &Person,
    year_assignments: i32,
    _total_assignments: i32,
    last_assignment_date: Option<NaiveDate>,
    current_date: NaiveDate,
) -> f64 {
    // Base score from assignment count (fewer = higher priority)
    let assignment_score = if year_assignments == 0 {
        1.0
    } else {
        1.0 / (year_assignments as f64 + 1.0)
    };

    // Recency score (longer since last assignment = higher priority)
    let recency_score = match last_assignment_date {
        None => 1.0,
        Some(last) => {
            let days_since = (current_date - last).num_days() as f64;
            let preferred_days = person.preferred_frequency.days_between() as f64;
            (days_since / preferred_days).min(1.0)
        }
    };

    // Preference level score
    let preference_score = person.preference_level as f64 / 10.0;

    // Weighted combination: fairness * 0.7 + recency * 0.2 + preference * 0.1
    (assignment_score * 0.7) + (recency_score * 0.2) + (preference_score * 0.1)
}
