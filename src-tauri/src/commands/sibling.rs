use crate::db::with_db;
use crate::models::{
    CreateSiblingGroupRequest, PairingRule, SiblingGroup, UpdateSiblingGroupRequest,
};
use uuid::Uuid;

#[tauri::command]
pub fn get_all_sibling_groups() -> Result<Vec<SiblingGroup>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, pairing_rule
             FROM sibling_groups
             ORDER BY name"
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

        // Fetch members for each group
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

#[tauri::command]
pub fn get_sibling_group(id: String) -> Result<SiblingGroup, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, pairing_rule
             FROM sibling_groups WHERE id = ?"
        )?;

        let mut group: SiblingGroup = stmt.query_row([&id], |row| {
            Ok(SiblingGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                pairing_rule: PairingRule::from_str(&row.get::<_, String>(2)?),
                created_at: None,
                updated_at: None,
                member_ids: Vec::new(),
            })
        })?;

        let mut member_stmt = conn.prepare(
            "SELECT person_id FROM sibling_group_members WHERE sibling_group_id = ?"
        )?;
        group.member_ids = member_stmt
            .query_map([&id], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(group)
    })
}

#[tauri::command]
pub fn create_sibling_group(request: CreateSiblingGroupRequest) -> Result<SiblingGroup, String> {
    let id = Uuid::new_v4().to_string();

    with_db(|conn| {
        conn.execute(
            "INSERT INTO sibling_groups (id, name, pairing_rule) VALUES (?, ?, ?)",
            duckdb::params![&id, &request.name, request.pairing_rule.to_string()],
        )?;

        // Add members
        for person_id in &request.member_ids {
            let member_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO sibling_group_members (id, sibling_group_id, person_id) VALUES (?, ?, ?)",
                duckdb::params![&member_id, &id, person_id],
            )?;
        }

        Ok(())
    })?;

    get_sibling_group(id)
}

#[tauri::command]
pub fn update_sibling_group(request: UpdateSiblingGroupRequest) -> Result<SiblingGroup, String> {
    with_db(|conn| {
        let current = {
            let mut stmt = conn.prepare(
                "SELECT name, pairing_rule FROM sibling_groups WHERE id = ?"
            )?;
            stmt.query_row([&request.id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
        };

        let name = request.name.unwrap_or(current.0);
        let pairing_rule = request
            .pairing_rule
            .map(|r| r.to_string())
            .unwrap_or(current.1);

        conn.execute(
            "UPDATE sibling_groups SET name = ?, pairing_rule = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
            duckdb::params![name, pairing_rule, &request.id],
        )?;

        // Update members if provided
        if let Some(member_ids) = request.member_ids {
            conn.execute(
                "DELETE FROM sibling_group_members WHERE sibling_group_id = ?",
                [&request.id],
            )?;
            for person_id in member_ids {
                let member_id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO sibling_group_members (id, sibling_group_id, person_id) VALUES (?, ?, ?)",
                    duckdb::params![&member_id, &request.id, &person_id],
                )?;
            }
        }

        Ok(())
    })?;

    get_sibling_group(request.id)
}

#[tauri::command]
pub fn delete_sibling_group(id: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute("DELETE FROM sibling_groups WHERE id = ?", [&id])?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_person_sibling_groups(person_id: String) -> Result<Vec<SiblingGroup>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT sg.id, sg.name, sg.pairing_rule
             FROM sibling_groups sg
             INNER JOIN sibling_group_members sgm ON sg.id = sgm.sibling_group_id
             WHERE sgm.person_id = ?
             ORDER BY sg.name"
        )?;

        let groups: Vec<SiblingGroup> = stmt
            .query_map([&person_id], |row| {
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

        // Fetch all members for each group
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
