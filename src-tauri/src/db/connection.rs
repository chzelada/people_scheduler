use duckdb::{Connection, Result as DuckResult};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

static DB_CONNECTION: OnceCell<Mutex<Connection>> = OnceCell::new();

pub fn get_db_path(app_handle: &AppHandle) -> PathBuf {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    app_dir.join("people_scheduler.duckdb")
}

pub fn init_db(app_handle: &AppHandle) -> DuckResult<()> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path)?;

    // Run migrations
    run_migrations(&conn)?;

    DB_CONNECTION
        .set(Mutex::new(conn))
        .expect("Database already initialized");

    Ok(())
}

pub fn get_connection() -> &'static Mutex<Connection> {
    DB_CONNECTION
        .get()
        .expect("Database not initialized. Call init_db first.")
}

fn run_migrations(conn: &Connection) -> DuckResult<()> {
    // Create migrations tracking table
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            name VARCHAR PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );"
    )?;

    // Define migrations
    let migrations = [
        ("001_initial_schema", include_str!("../../../migrations/001_initial_schema.sql")),
        ("002_job_positions", include_str!("../../../migrations/002_job_positions.sql")),
    ];

    for (name, sql) in migrations {
        // Check if migration was already applied
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM _migrations WHERE name = ?")?;
        let count: i64 = stmt.query_row([name], |row| row.get(0))?;

        if count == 0 {
            conn.execute_batch(sql)?;
            conn.execute(
                "INSERT INTO _migrations (name) VALUES (?)",
                [name],
            )?;
        }
    }

    Ok(())
}

// Database helper trait for executing queries
pub trait DbExecutor {
    fn with_connection<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&Connection) -> DuckResult<R>;
}

impl DbExecutor for () {
    fn with_connection<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&Connection) -> DuckResult<R>,
    {
        let conn = get_connection().lock();
        f(&conn).map_err(|e| e.to_string())
    }
}

pub fn with_db<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&Connection) -> DuckResult<R>,
{
    let conn = get_connection().lock();
    f(&conn).map_err(|e| e.to_string())
}
