use crate::commands::get_schedule;
use xlsxwriter::Workbook;
use std::path::PathBuf;

pub fn export_schedule_to_excel(schedule_id: &str, output_path: &PathBuf) -> Result<(), String> {
    let schedule = get_schedule(schedule_id.to_string())?;

    let workbook = Workbook::new(output_path.to_str().ok_or("Invalid path")?)
        .map_err(|e| e.to_string())?;

    let mut sheet = workbook.add_worksheet(Some("Schedule"))
        .map_err(|e| e.to_string())?;

    // Set column widths
    sheet.set_column(0, 0, 15.0, None).map_err(|e| e.to_string())?;
    sheet.set_column(1, 10, 20.0, None).map_err(|e| e.to_string())?;

    // Write title
    let title = format!("{} - Schedule", schedule.name);
    sheet.write_string(0, 0, &title, None)
        .map_err(|e| e.to_string())?;

    let mut row = 2u32;

    // Group assignments by job for each date
    for service_date in &schedule.service_dates {
        // Write date header
        let date_str = service_date.service_date.format("%B %d, %Y (%A)").to_string();
        sheet.write_string(row, 0, &date_str, None)
            .map_err(|e| e.to_string())?;
        row += 1;

        // Group by job
        let mut jobs_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

        for assignment in &service_date.assignments {
            let job_name = assignment.job_name.clone().unwrap_or_else(|| assignment.job_id.clone());
            let person_name = assignment.person_name.clone().unwrap_or_else(|| assignment.person_id.clone());

            jobs_map.entry(job_name).or_default().push(person_name);
        }

        // Write each job's assignments
        for (job_name, people) in &jobs_map {
            sheet.write_string(row, 0, job_name, None)
                .map_err(|e| e.to_string())?;

            for (i, person) in people.iter().enumerate() {
                sheet.write_string(row, (i + 1) as u16, person, None)
                    .map_err(|e| e.to_string())?;
            }
            row += 1;
        }

        row += 1; // Empty row between dates
    }

    workbook.close().map_err(|e| e.to_string())?;

    Ok(())
}
