use crate::export::export_schedule_to_excel;
use std::path::PathBuf;

#[tauri::command]
pub fn export_schedule_to_path(schedule_id: String, path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);
    export_schedule_to_excel(&schedule_id, &path_buf)
}
