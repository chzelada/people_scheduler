mod commands;
mod db;
mod export;
mod models;
mod scheduler;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize database
            db::init_db(app.handle()).expect("Failed to initialize database");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // People commands
            get_all_people,
            get_person,
            create_person,
            update_person,
            delete_person,
            get_people_for_job,
            // Jobs commands
            get_all_jobs,
            get_job,
            create_job,
            update_job,
            delete_job,
            // Schedule commands
            get_all_schedules,
            get_schedule,
            generate_schedule,
            save_schedule,
            update_assignment,
            publish_schedule,
            delete_schedule,
            get_fairness_scores,
            get_schedule_by_month,
            get_person_assignment_history,
            get_eligible_people_for_assignment,
            // Sibling group commands
            get_all_sibling_groups,
            get_sibling_group,
            create_sibling_group,
            update_sibling_group,
            delete_sibling_group,
            get_person_sibling_groups,
            // Unavailability commands
            get_all_unavailability,
            get_person_unavailability,
            get_unavailability,
            create_unavailability,
            update_unavailability,
            delete_unavailability,
            check_availability,
            // Export commands
            export_schedule_to_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
