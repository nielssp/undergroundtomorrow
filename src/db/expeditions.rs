use chrono::{DateTime, Utc};
use sqlx::{types::Json, PgPool};

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
}
