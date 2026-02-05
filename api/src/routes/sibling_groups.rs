use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{CreateSiblingGroup, SiblingGroup, SiblingGroupWithMembers};

pub async fn get_all(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<SiblingGroupWithMembers>>, (StatusCode, String)> {
    let groups = sqlx::query_as::<_, SiblingGroup>("SELECT * FROM sibling_groups ORDER BY name")
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result = Vec::new();
    for group in groups {
        let member_ids: Vec<String> = sqlx::query_scalar(
            "SELECT person_id FROM sibling_group_members WHERE sibling_group_id = $1",
        )
        .bind(&group.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        result.push(SiblingGroupWithMembers { group, member_ids });
    }

    Ok(Json(result))
}

pub async fn create(
    State(pool): State<PgPool>,
    Json(input): Json<CreateSiblingGroup>,
) -> Result<Json<SiblingGroupWithMembers>, (StatusCode, String)> {
    let id = Uuid::new_v4().to_string();

    let group = sqlx::query_as::<_, SiblingGroup>(
        r#"
        INSERT INTO sibling_groups (id, name, pairing_rule)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.pairing_rule)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Add members
    for member_id in &input.member_ids {
        let sgm_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO sibling_group_members (id, sibling_group_id, person_id) VALUES ($1, $2, $3)"
        )
        .bind(&sgm_id)
        .bind(&id)
        .bind(member_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(SiblingGroupWithMembers {
        group,
        member_ids: input.member_ids,
    }))
}

pub async fn update(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
    Json(input): Json<CreateSiblingGroup>,
) -> Result<Json<SiblingGroupWithMembers>, (StatusCode, String)> {
    // Update group
    let group = sqlx::query_as::<_, SiblingGroup>(
        r#"
        UPDATE sibling_groups
        SET name = $1, pairing_rule = $2
        WHERE id = $3
        RETURNING *
        "#,
    )
    .bind(&input.name)
    .bind(&input.pairing_rule)
    .bind(&id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Update members - delete existing and re-add
    sqlx::query("DELETE FROM sibling_group_members WHERE sibling_group_id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for member_id in &input.member_ids {
        let sgm_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO sibling_group_members (id, sibling_group_id, person_id) VALUES ($1, $2, $3)"
        )
        .bind(&sgm_id)
        .bind(&id)
        .bind(member_id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(SiblingGroupWithMembers {
        group,
        member_ids: input.member_ids,
    }))
}

pub async fn delete(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM sibling_groups WHERE id = $1")
        .bind(&id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Sibling group not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
