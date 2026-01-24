use chrono::{Datelike, NaiveDate, Weekday};
use uuid::Uuid;

use crate::db::with_db;
use crate::models::{
    Assignment, ConflictType, GenerateScheduleRequest, Job, Person, PreferredFrequency,
    Schedule, ScheduleConflict, SchedulePreview, ScheduleStatus, ServiceDate, SiblingGroup,
    FairnessScore, PairingRule,
};
use crate::scheduler::constraints::{
    calculate_fairness_score, check_consecutive_weeks, check_sibling_constraint, is_available,
    SiblingConstraintResult,
};

pub struct ScheduleGenerator;

impl ScheduleGenerator {
    pub fn new() -> Self {
        Self
    }

    pub fn generate(&self, request: GenerateScheduleRequest) -> Result<SchedulePreview, String> {
        // Get all required data
        let jobs = self.get_active_jobs()?;
        let people = self.get_active_people()?;
        let sibling_groups = self.get_sibling_groups()?;
        let unavailable = self.get_unavailability(request.year, request.month)?;
        let assignment_history = self.get_assignment_history(request.year)?;

        // Get Sundays in the month
        let sundays = self.get_sundays(request.year, request.month);

        // Create schedule
        let schedule_id = Uuid::new_v4().to_string();
        let schedule_name = request.name.unwrap_or_else(|| {
            format!("{} {}", month_name(request.month), request.year)
        });

        let mut service_dates = Vec::new();
        let mut conflicts = Vec::new();
        let mut all_assignments: Vec<(String, NaiveDate)> = assignment_history.clone();

        for sunday in &sundays {
            let service_date_id = Uuid::new_v4().to_string();
            let mut assignments = Vec::new();

            for job in &jobs {
                let job_assignments = self.assign_people_to_job(
                    job,
                    *sunday,
                    &people,
                    &sibling_groups,
                    &unavailable,
                    &all_assignments,
                    &mut conflicts,
                    &service_date_id,
                );

                // Track new assignments for subsequent dates
                for a in &job_assignments {
                    all_assignments.push((a.person_id.clone(), *sunday));
                }

                assignments.extend(job_assignments);
            }

            service_dates.push(ServiceDate {
                id: service_date_id,
                schedule_id: schedule_id.clone(),
                service_date: *sunday,
                notes: None,
                created_at: None,
                assignments,
            });
        }

        let schedule = Schedule {
            id: schedule_id,
            name: schedule_name,
            year: request.year,
            month: request.month,
            status: ScheduleStatus::Draft,
            created_at: None,
            updated_at: None,
            published_at: None,
            service_dates,
        };

        // Calculate fairness scores
        let fairness_scores = self.calculate_all_fairness_scores(&people, &all_assignments, request.year)?;

        Ok(SchedulePreview {
            schedule,
            conflicts,
            fairness_scores,
        })
    }

    fn assign_people_to_job(
        &self,
        job: &Job,
        date: NaiveDate,
        people: &[Person],
        sibling_groups: &[SiblingGroup],
        unavailable: &[(String, NaiveDate, NaiveDate)],
        recent_assignments: &[(String, NaiveDate)],
        conflicts: &mut Vec<ScheduleConflict>,
        service_date_id: &str,
    ) -> Vec<Assignment> {
        // Filter people qualified for this job
        let qualified: Vec<&Person> = people
            .iter()
            .filter(|p| p.job_ids.contains(&job.id))
            .collect();

        // Score each candidate
        let mut candidates: Vec<(&Person, f64)> = Vec::new();

        for person in &qualified {
            // Check availability
            if !is_available(&person.id, date, unavailable) {
                continue;
            }

            // Check consecutive weeks
            if !check_consecutive_weeks(person, date, recent_assignments) {
                continue;
            }

            // Calculate base score
            let year_assignments = recent_assignments
                .iter()
                .filter(|(pid, d)| pid == &person.id && d.year() == date.year())
                .count() as i32;

            let total_assignments = recent_assignments
                .iter()
                .filter(|(pid, _)| pid == &person.id)
                .count() as i32;

            let last_date = recent_assignments
                .iter()
                .filter(|(pid, _)| pid == &person.id)
                .map(|(_, d)| *d)
                .max();

            let score = calculate_fairness_score(
                person,
                year_assignments,
                total_assignments,
                last_date,
                date,
            );

            candidates.push((person, score));
        }

        // Sort by score (highest first)
        candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Select people considering sibling constraints
        let mut selected: Vec<Assignment> = Vec::new();
        let mut selected_ids: Vec<String> = Vec::new();
        let mut position = 1;

        // First pass: find TOGETHER siblings that should be grouped
        let together_groups: Vec<&SiblingGroup> = sibling_groups
            .iter()
            .filter(|g| g.pairing_rule == PairingRule::Together)
            .collect();

        for (person, _score) in &candidates {
            if selected.len() >= job.people_required as usize {
                break;
            }

            // Check sibling constraint
            let constraint = check_sibling_constraint(&person.id, &selected_ids, sibling_groups);

            match constraint {
                SiblingConstraintResult::Forbidden => continue,
                SiblingConstraintResult::Preferred | SiblingConstraintResult::Neutral => {
                    // Find person's name for the assignment
                    let person_name = format!("{} {}", person.first_name, person.last_name);

                    selected.push(Assignment {
                        id: Uuid::new_v4().to_string(),
                        service_date_id: service_date_id.to_string(),
                        job_id: job.id.clone(),
                        person_id: person.id.clone(),
                        position,
                        manual_override: false,
                        created_at: None,
                        updated_at: None,
                        person_name: Some(person_name),
                        job_name: Some(job.name.clone()),
                    });
                    selected_ids.push(person.id.clone());
                    position += 1;

                    // If this person is in a TOGETHER group, try to add siblings
                    for group in &together_groups {
                        if group.member_ids.contains(&person.id) {
                            for sibling_id in &group.member_ids {
                                if selected.len() >= job.people_required as usize {
                                    break;
                                }
                                if selected_ids.contains(sibling_id) || sibling_id == &person.id {
                                    continue;
                                }

                                // Find sibling in candidates
                                if let Some(sibling) = people.iter().find(|p| p.id == *sibling_id) {
                                    if is_available(&sibling.id, date, unavailable) {
                                        let sibling_name = format!("{} {}", sibling.first_name, sibling.last_name);
                                        selected.push(Assignment {
                                            id: Uuid::new_v4().to_string(),
                                            service_date_id: service_date_id.to_string(),
                                            job_id: job.id.clone(),
                                            person_id: sibling.id.clone(),
                                            position,
                                            manual_override: false,
                                            created_at: None,
                                            updated_at: None,
                                            person_name: Some(sibling_name),
                                            job_name: Some(job.name.clone()),
                                        });
                                        selected_ids.push(sibling.id.clone());
                                        position += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Check if we have enough people
        if selected.len() < job.people_required as usize {
            conflicts.push(ScheduleConflict {
                service_date: date,
                job_id: job.id.clone(),
                conflict_type: ConflictType::InsufficientPeople,
                message: format!(
                    "Only {} of {} required {} assigned for {}",
                    selected.len(),
                    job.people_required,
                    job.name,
                    date
                ),
                affected_person_ids: selected_ids.clone(),
            });
        }

        selected
    }

    fn get_active_jobs(&self) -> Result<Vec<Job>, String> {
        with_db(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, people_required, color, active
                 FROM jobs WHERE active = TRUE ORDER BY name"
            )?;

            let jobs: Vec<Job> = stmt
                .query_map([], |row| {
                    Ok(Job {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        people_required: row.get(3)?,
                        color: row.get(4)?,
                        active: row.get(5)?,
                        created_at: None,
                        updated_at: None,
                    })
                })?
                .filter_map(|r| r.ok())
                .collect();

            Ok(jobs)
        })
    }

    fn get_active_people(&self) -> Result<Vec<Person>, String> {
        with_db(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, first_name, last_name, email, phone,
                        preferred_frequency, max_consecutive_weeks, preference_level,
                        active, notes
                 FROM people WHERE active = TRUE
                 ORDER BY last_name, first_name"
            )?;

            let people: Vec<Person> = stmt
                .query_map([], |row| {
                    Ok(Person {
                        id: row.get(0)?,
                        first_name: row.get(1)?,
                        last_name: row.get(2)?,
                        email: row.get(3)?,
                        phone: row.get(4)?,
                        preferred_frequency: PreferredFrequency::from_str(&row.get::<_, String>(5)?),
                        max_consecutive_weeks: row.get(6)?,
                        preference_level: row.get(7)?,
                        active: row.get(8)?,
                        notes: row.get(9)?,
                        created_at: None,
                        updated_at: None,
                        job_ids: Vec::new(),
                    })
                })?
                .filter_map(|r| r.ok())
                .collect();

            // Fetch job IDs for each person
            let mut result = Vec::new();
            for mut person in people {
                let mut job_stmt = conn.prepare(
                    "SELECT job_id FROM person_jobs WHERE person_id = ?"
                )?;
                person.job_ids = job_stmt
                    .query_map([&person.id], |row| row.get(0))?
                    .filter_map(|r| r.ok())
                    .collect();
                result.push(person);
            }

            Ok(result)
        })
    }

    fn get_sibling_groups(&self) -> Result<Vec<SiblingGroup>, String> {
        with_db(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, pairing_rule FROM sibling_groups ORDER BY name"
            )?;

            let groups: Vec<SiblingGroup> = stmt
                .query_map([], |row| {
                    Ok(SiblingGroup {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        pairing_rule: PairingRule::from_str(&row.get::<_, String>(2)?),
                        created_at: None,
                        updated_at: None,
                        member_ids: Vec::new(),
                    })
                })?
                .filter_map(|r| r.ok())
                .collect();

            let mut result = Vec::new();
            for mut group in groups {
                let mut member_stmt = conn.prepare(
                    "SELECT person_id FROM sibling_group_members WHERE sibling_group_id = ?"
                )?;
                group.member_ids = member_stmt
                    .query_map([&group.id], |row| row.get(0))?
                    .filter_map(|r| r.ok())
                    .collect();
                result.push(group);
            }

            Ok(result)
        })
    }

    fn get_unavailability(&self, year: i32, month: i32) -> Result<Vec<(String, NaiveDate, NaiveDate)>, String> {
        let first_day = NaiveDate::from_ymd_opt(year, month as u32, 1)
            .ok_or("Invalid date")?;
        let last_day = if month == 12 {
            NaiveDate::from_ymd_opt(year + 1, 1, 1)
        } else {
            NaiveDate::from_ymd_opt(year, month as u32 + 1, 1)
        }
        .ok_or("Invalid date")?
        .pred_opt()
        .ok_or("Invalid date")?;

        with_db(|conn| {
            let mut stmt = conn.prepare(
                "SELECT person_id, CAST(start_date AS VARCHAR), CAST(end_date AS VARCHAR) FROM unavailability
                 WHERE (start_date <= ? AND end_date >= ?) OR recurring = TRUE"
            )?;

            let unavailable: Vec<(String, NaiveDate, NaiveDate)> = stmt
                .query_map(duckdb::params![last_day.to_string(), first_day.to_string()], |row| {
                    let person_id: String = row.get(0)?;
                    let start_str: String = row.get(1)?;
                    let end_str: String = row.get(2)?;
                    let start = NaiveDate::parse_from_str(&start_str, "%Y-%m-%d")
                        .unwrap_or(first_day);
                    let end = NaiveDate::parse_from_str(&end_str, "%Y-%m-%d")
                        .unwrap_or(last_day);
                    Ok((person_id, start, end))
                })?
                .filter_map(|r| r.ok())
                .collect();

            Ok(unavailable)
        })
    }

    fn get_assignment_history(&self, year: i32) -> Result<Vec<(String, NaiveDate)>, String> {
        with_db(|conn| {
            let mut stmt = conn.prepare(
                "SELECT person_id, CAST(service_date AS VARCHAR) FROM assignment_history
                 WHERE year >= ? - 1 ORDER BY service_date"
            )?;

            let history: Vec<(String, NaiveDate)> = stmt
                .query_map([year], |row| {
                    let person_id: String = row.get(0)?;
                    let date_str: String = row.get(1)?;
                    let date = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                        .unwrap_or(NaiveDate::from_ymd_opt(year, 1, 1).unwrap());
                    Ok((person_id, date))
                })?
                .filter_map(|r| r.ok())
                .collect();

            Ok(history)
        })
    }

    fn get_sundays(&self, year: i32, month: i32) -> Vec<NaiveDate> {
        let mut sundays = Vec::new();
        let mut date = NaiveDate::from_ymd_opt(year, month as u32, 1).unwrap();

        while date.month() == month as u32 {
            if date.weekday() == Weekday::Sun {
                sundays.push(date);
            }
            date = date.succ_opt().unwrap();
        }

        sundays
    }

    fn calculate_all_fairness_scores(
        &self,
        people: &[Person],
        all_assignments: &[(String, NaiveDate)],
        year: i32,
    ) -> Result<Vec<FairnessScore>, String> {
        let mut scores = Vec::new();

        for person in people {
            let year_assignments = all_assignments
                .iter()
                .filter(|(pid, d)| pid == &person.id && d.year() == year)
                .count() as i32;

            let total_assignments = all_assignments
                .iter()
                .filter(|(pid, _)| pid == &person.id)
                .count() as i32;

            let last_date = all_assignments
                .iter()
                .filter(|(pid, _)| pid == &person.id)
                .map(|(_, d)| *d)
                .max();

            let fairness = if total_assignments == 0 {
                1.0
            } else {
                1.0 / (year_assignments as f64 + 1.0)
            };

            scores.push(FairnessScore {
                person_id: person.id.clone(),
                person_name: format!("{} {}", person.first_name, person.last_name),
                total_assignments,
                assignments_this_year: year_assignments,
                assignments_by_job: Vec::new(),
                last_assignment_date: last_date,
                fairness_score: fairness,
            });
        }

        // Sort by fairness score descending
        scores.sort_by(|a, b| b.fairness_score.partial_cmp(&a.fairness_score).unwrap_or(std::cmp::Ordering::Equal));

        Ok(scores)
    }
}

fn month_name(month: i32) -> &'static str {
    match month {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => "Unknown",
    }
}
