use crate::db::with_db;
use crate::models::{CreateUnavailabilityRequest, Unavailability, UpdateUnavailabilityRequest};
use uuid::Uuid;

#[tauri::command]
pub fn get_all_unavailability() -> Result<Vec<Unavailability>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT u.id, u.person_id, CAST(u.start_date AS VARCHAR), CAST(u.end_date AS VARCHAR),
                    u.reason, u.recurring,
                    p.first_name || ' ' || p.last_name as person_name
             FROM unavailability u
             INNER JOIN people p ON u.person_id = p.id
             ORDER BY u.start_date DESC"
        )?;

        let records: Vec<Unavailability> = stmt
            .query_map([], |row| {
                Ok(Unavailability {
                    id: row.get(0)?,
                    person_id: row.get(1)?,
                    start_date: row.get(2)?,
                    end_date: row.get(3)?,
                    reason: row.get(4)?,
                    recurring: row.get(5)?,
                    created_at: None,
                    person_name: row.get(6).ok(),
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(records)
    })
}

#[tauri::command]
pub fn get_person_unavailability(person_id: String) -> Result<Vec<Unavailability>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, person_id, CAST(start_date AS VARCHAR), CAST(end_date AS VARCHAR),
                    reason, recurring
             FROM unavailability
             WHERE person_id = ?
             ORDER BY start_date DESC"
        )?;

        let records: Vec<Unavailability> = stmt
            .query_map([&person_id], |row| {
                Ok(Unavailability {
                    id: row.get(0)?,
                    person_id: row.get(1)?,
                    start_date: row.get(2)?,
                    end_date: row.get(3)?,
                    reason: row.get(4)?,
                    recurring: row.get(5)?,
                    created_at: None,
                    person_name: None,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(records)
    })
}

#[tauri::command]
pub fn create_unavailability(request: CreateUnavailabilityRequest) -> Result<Unavailability, String> {
    let id = Uuid::new_v4().to_string();

    with_db(|conn| {
        conn.execute(
            "INSERT INTO unavailability (id, person_id, start_date, end_date, reason, recurring)
             VALUES (?, ?, ?, ?, ?, ?)",
            duckdb::params![
                &id,
                &request.person_id,
                &request.start_date,
                &request.end_date,
                &request.reason,
                request.recurring.unwrap_or(false)
            ],
        )?;
        Ok(())
    })?;

    get_unavailability(id)
}

#[tauri::command]
pub fn get_unavailability(id: String) -> Result<Unavailability, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT u.id, u.person_id, CAST(u.start_date AS VARCHAR), CAST(u.end_date AS VARCHAR),
                    u.reason, u.recurring,
                    p.first_name || ' ' || p.last_name as person_name
             FROM unavailability u
             INNER JOIN people p ON u.person_id = p.id
             WHERE u.id = ?"
        )?;

        let record = stmt.query_row([&id], |row| {
            Ok(Unavailability {
                id: row.get(0)?,
                person_id: row.get(1)?,
                start_date: row.get(2)?,
                end_date: row.get(3)?,
                reason: row.get(4)?,
                recurring: row.get(5)?,
                created_at: None,
                person_name: row.get(6).ok(),
            })
        })?;

        Ok(record)
    })
}

#[tauri::command]
pub fn update_unavailability(request: UpdateUnavailabilityRequest) -> Result<Unavailability, String> {
    with_db(|conn| {
        let current = {
            let mut stmt = conn.prepare(
                "SELECT CAST(start_date AS VARCHAR), CAST(end_date AS VARCHAR), reason, recurring
                 FROM unavailability WHERE id = ?"
            )?;
            stmt.query_row([&request.id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, bool>(3)?,
                ))
            })?
        };

        let start_date = request.start_date.unwrap_or(current.0);
        let end_date = request.end_date.unwrap_or(current.1);
        let reason = request.reason.or(current.2);
        let recurring = request.recurring.unwrap_or(current.3);

        conn.execute(
            "UPDATE unavailability SET start_date = ?, end_date = ?, reason = ?, recurring = ?
             WHERE id = ?",
            duckdb::params![start_date, end_date, reason, recurring, &request.id],
        )?;

        Ok(())
    })?;

    get_unavailability(request.id)
}

#[tauri::command]
pub fn delete_unavailability(id: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute("DELETE FROM unavailability WHERE id = ?", [&id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn check_availability(person_id: String, date: String) -> Result<bool, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT COUNT(*) FROM unavailability
             WHERE person_id = ? AND ? BETWEEN start_date AND end_date"
        )?;

        let count: i64 = stmt.query_row(duckdb::params![&person_id, &date], |row| row.get(0))?;

        Ok(count == 0)
    })
}
