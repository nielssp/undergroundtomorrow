use chrono::{DateTime, Utc};
use sqlx::{types::Json, PgPool, Row};

use crate::error;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpeditionData {}

#[derive(serde::Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Expedition {
    pub id: i32,
    pub bunker_id: i32,
    pub location_id: Option<i32>,
    pub zone_x: i32,
    pub zone_y: i32,
    pub eta: DateTime<Utc>,
    pub data: Json<ExpeditionData>,
    pub created: DateTime<Utc>,
}

pub struct NewExpedition {
    pub bunker_id: i32,
    pub location_id: Option<i32>,
    pub zone_x: i32,
    pub zone_y: i32,
    pub eta: DateTime<Utc>,
    pub data: ExpeditionData,
}

pub async fn create_expedition(
    pool: &PgPool,
    expedition: &NewExpedition,
) -> Result<i32, error::Error> {
    Ok(sqlx::query(
        "INSERT INTO expeditions (bunker_id, location_id, zone_x, zone_y, eta, data, created) \
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(expedition.bunker_id)
    .bind(expedition.location_id)
    .bind(expedition.zone_x)
    .bind(expedition.zone_y)
    .bind(expedition.eta)
    .bind(Json(&expedition.data))
    .bind(Utc::now())
    .fetch_one(pool)
    .await?
    .try_get(0)?)
}

pub async fn delete_expedition(pool: &PgPool, expedition_id: i32) -> Result<(), error::Error> {
    sqlx::query("DELETE FROM expeditions WHERE id = $1")
        .bind(expedition_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_expeditions(
    pool: &PgPool,
    bunker_id: i32,
) -> Result<Vec<Expedition>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM expeditions WHERE bunker_id = $1")
            .bind(bunker_id)
            .fetch_all(pool)
            .await?,
    )
}

pub async fn get_finished_expeditions(pool: &PgPool) -> Result<Vec<Expedition>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM expeditions WHERE eta <= CURRENT_TIMESTAMP")
            .fetch_all(pool)
            .await?,
    )
}
