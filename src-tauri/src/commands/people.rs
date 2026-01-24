use crate::db::with_db;
use crate::models::{CreatePersonRequest, Person, PreferredFrequency, UpdatePersonRequest};
use uuid::Uuid;

#[tauri::command]
pub fn get_all_people() -> Result<Vec<Person>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT p.id, p.first_name, p.last_name, p.email, p.phone,
                    p.preferred_frequency, p.max_consecutive_weeks, p.preference_level,
                    p.active, p.notes
             FROM people p
             ORDER BY p.last_name, p.first_name"
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

        // Fetch job assignments for each person
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

#[tauri::command]
pub fn get_person(id: String) -> Result<Person, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, first_name, last_name, email, phone,
                    preferred_frequency, max_consecutive_weeks, preference_level,
                    active, notes
             FROM people WHERE id = ?"
        )?;

        let mut person: Person = stmt.query_row([&id], |row| {
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
        })?;

        // Fetch job assignments
        let mut job_stmt = conn.prepare("SELECT job_id FROM person_jobs WHERE person_id = ?")?;
        person.job_ids = job_stmt
            .query_map([&id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(person)
    })
}

#[tauri::command]
pub fn create_person(request: CreatePersonRequest) -> Result<Person, String> {
    let id = Uuid::new_v4().to_string();
    let freq = request.preferred_frequency.unwrap_or_default();

    with_db(|conn| {
        conn.execute(
            "INSERT INTO people (id, first_name, last_name, email, phone,
                                preferred_frequency, max_consecutive_weeks, preference_level, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            duckdb::params![
                &id,
                &request.first_name,
                &request.last_name,
                &request.email,
                &request.phone,
                freq.to_string(),
                request.max_consecutive_weeks.unwrap_or(2),
                request.preference_level.unwrap_or(5),
                &request.notes
            ],
        )?;

        // Add job assignments
        for job_id in &request.job_ids {
            let pj_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO person_jobs (id, person_id, job_id) VALUES (?, ?, ?)",
                duckdb::params![&pj_id, &id, job_id],
            )?;
        }

        Ok(())
    })?;

    get_person(id)
}

#[tauri::command]
pub fn update_person(request: UpdatePersonRequest) -> Result<Person, String> {
    with_db(|conn| {
        let current = {
            let mut stmt = conn.prepare(
                "SELECT id, first_name, last_name, email, phone,
                        preferred_frequency, max_consecutive_weeks, preference_level,
                        active, notes
                 FROM people WHERE id = ?"
            )?;
            stmt.query_row([&request.id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, i32>(6)?,
                    row.get::<_, i32>(7)?,
                    row.get::<_, bool>(8)?,
                    row.get::<_, Option<String>>(9)?,
                ))
            })?
        };

        let first_name = request.first_name.unwrap_or(current.1);
        let last_name = request.last_name.unwrap_or(current.2);
        let email = request.email.or(current.3);
        let phone = request.phone.or(current.4);
        let freq = request
            .preferred_frequency
            .map(|f| f.to_string())
            .unwrap_or(current.5);
        let max_consecutive = request.max_consecutive_weeks.unwrap_or(current.6);
        let pref_level = request.preference_level.unwrap_or(current.7);
        let active = request.active.unwrap_or(current.8);
        let notes = request.notes.or(current.9);

        conn.execute(
            "UPDATE people SET
                first_name = ?, last_name = ?, email = ?, phone = ?,
                preferred_frequency = ?, max_consecutive_weeks = ?,
                preference_level = ?, active = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
            duckdb::params![
                first_name,
                last_name,
                email,
                phone,
                freq,
                max_consecutive,
                pref_level,
                active,
                notes,
                &request.id
            ],
        )?;

        // Update job assignments if provided
        if let Some(job_ids) = request.job_ids {
            conn.execute(
                "DELETE FROM person_jobs WHERE person_id = ?",
                [&request.id],
            )?;
            for job_id in job_ids {
                let pj_id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO person_jobs (id, person_id, job_id) VALUES (?, ?, ?)",
                    duckdb::params![&pj_id, &request.id, &job_id],
                )?;
            }
        }

        Ok(())
    })?;

    get_person(request.id)
}

#[tauri::command]
pub fn delete_person(id: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute("DELETE FROM people WHERE id = ?", [&id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_people_for_job(job_id: String) -> Result<Vec<Person>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT p.id, p.first_name, p.last_name, p.email, p.phone,
                    p.preferred_frequency, p.max_consecutive_weeks, p.preference_level,
                    p.active, p.notes
             FROM people p
             INNER JOIN person_jobs pj ON p.id = pj.person_id
             WHERE pj.job_id = ? AND p.active = TRUE
             ORDER BY p.last_name, p.first_name"
        )?;

        let people: Vec<Person> = stmt
            .query_map([&job_id], |row| {
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
                    job_ids: vec![job_id.clone()],
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(people)
    })
}
