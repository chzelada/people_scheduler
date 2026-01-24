use crate::db::with_db;
use crate::models::{CreateJobRequest, Job, UpdateJobRequest};
use uuid::Uuid;

#[tauri::command]
pub fn get_all_jobs() -> Result<Vec<Job>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, people_required, color, active
             FROM jobs
             ORDER BY name"
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

#[tauri::command]
pub fn get_job(id: String) -> Result<Job, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, description, people_required, color, active
             FROM jobs WHERE id = ?"
        )?;

        let job = stmt.query_row([&id], |row| {
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
        })?;

        Ok(job)
    })
}

#[tauri::command]
pub fn create_job(request: CreateJobRequest) -> Result<Job, String> {
    let id = Uuid::new_v4().to_string();

    with_db(|conn| {
        conn.execute(
            "INSERT INTO jobs (id, name, description, people_required, color)
             VALUES (?, ?, ?, ?, ?)",
            duckdb::params![
                &id,
                &request.name,
                &request.description,
                request.people_required.unwrap_or(4),
                request.color.as_deref().unwrap_or("#3B82F6")
            ],
        )?;
        Ok(())
    })?;

    get_job(id)
}

#[tauri::command]
pub fn update_job(request: UpdateJobRequest) -> Result<Job, String> {
    with_db(|conn| {
        let current = {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, people_required, color, active
                 FROM jobs WHERE id = ?"
            )?;
            stmt.query_row([&request.id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, i32>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, bool>(5)?,
                ))
            })?
        };

        let name = request.name.unwrap_or(current.1);
        let description = request.description.or(current.2);
        let people_required = request.people_required.unwrap_or(current.3);
        let color = request.color.unwrap_or(current.4);
        let active = request.active.unwrap_or(current.5);

        conn.execute(
            "UPDATE jobs SET name = ?, description = ?, people_required = ?,
                            color = ?, active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
            duckdb::params![name, description, people_required, color, active, &request.id],
        )?;

        Ok(())
    })?;

    get_job(request.id)
}

#[tauri::command]
pub fn delete_job(id: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute("DELETE FROM jobs WHERE id = ?", [&id])?;
        Ok(())
    })
}
