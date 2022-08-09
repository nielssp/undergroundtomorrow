use chrono::{DateTime, Utc};
use sqlx::{postgres::PgArguments, query::Query, types::Json, PgPool, Postgres, Row};

use crate::error;

#[derive(sqlx::FromRow, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bunker {
    pub id: i32,
    pub user_id: i64,
    pub world_id: i32,
    pub number: i32,
    pub x: i32,
    pub y: i32,
    pub next_tick: DateTime<Utc>,
    pub data: Json<BunkerData>,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BunkerData {
    #[serde(default)]
    pub scrap_metal: i32,
    #[serde(default)]
    pub scrap_electronics: i32,
    #[serde(default)]
    pub reactor: ReactorStatus,
    #[serde(default)]
    pub water_treatment: WaterTreatmentStatus,
    #[serde(default)]
    pub infirmary: InfirmaryStatus,
    #[serde(default)]
    pub workshop: WorkshopStatus,
    #[serde(default)]
    pub horticulture: HorticultureStatus,
    #[serde(default)]
    pub air_recycling: AirRecyclingStatus,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ReactorStatus {
    #[serde(default)]
    pub maintenance: i32,
    #[serde(default)]
    pub fuel: i32,
    #[serde(default)]
    pub malfunction: bool,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WaterTreatmentStatus {
    #[serde(default)]
    pub maintenance: i32,
    #[serde(default)]
    pub malfunction: bool,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InfirmaryStatus {
    #[serde(default)]
    pub medicine: i32, // TODO: antiseptics, antibiotics, painkillers, etc.?
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkshopStatus {
    pub level: i32,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HorticultureStatus {
    pub crops: Vec<Crop>,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Crop {
    pub seed_type: String,
    pub name: String,
    pub quantity: i32,
    pub stage: i32,
    pub max: i32,
    #[serde(default)]
    pub stunted: bool,
}

#[derive(serde::Deserialize, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AirRecyclingStatus {
    #[serde(default)]
    pub maintenance: i32,
    #[serde(default)]
    pub malfunction: bool,
}

pub struct NewBunker {
    pub user_id: i64,
    pub world_id: i32,
    pub number: i32,
    pub x: i32,
    pub y: i32,
    pub data: BunkerData,
}

pub async fn get_bunker_by_world_and_user(
    pool: &PgPool,
    world_id: i32,
    user_id: i64,
) -> Result<Option<Bunker>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM bunkers WHERE world_id = $1 AND user_id = $2")
            .bind(world_id)
            .bind(user_id)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn get_max_bunker_number(
    pool: &PgPool,
    world_id: i32,
) -> Result<Option<i32>, error::Error> {
    Ok(
        sqlx::query("SELECT MAX(number) FROM bunkers WHERE world_id = $1")
            .bind(world_id)
            .try_map(|row| row.try_get(0))
            .fetch_one(pool)
            .await?,
    )
}

pub async fn create_bunker(pool: &PgPool, bunker: &NewBunker) -> Result<i32, error::Error> {
    Ok(sqlx::query(
        "INSERT INTO bunkers (user_id, world_id, number, x, y, data) \
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(bunker.user_id)
    .bind(bunker.world_id)
    .bind(bunker.number)
    .bind(bunker.x)
    .bind(bunker.y)
    .bind(Json(&bunker.data))
    .fetch_one(pool)
    .await?
    .try_get(0)?)
}

pub async fn get_bunkers_by_next_tick(
    pool: &PgPool,
    world_id: i32,
) -> Result<Vec<Bunker>, error::Error> {
    Ok(sqlx::query_as(
        "SELECT * FROM bunkers WHERE world_id = $1 AND next_tick <= CURRENT_TIMESTAMP",
    )
    .bind(world_id)
    .fetch_all(pool)
    .await?)
}

pub async fn update_bunker_data_and_tick(
    pool: &PgPool,
    bunker: &Bunker,
) -> Result<(), error::Error> {
    sqlx::query("UPDATE bunkers SET next_tick = $2, data = $3 WHERE id = $1")
        .bind(bunker.id)
        .bind(bunker.next_tick)
        .bind(&bunker.data)
        .execute(pool)
        .await?;
    Ok(())
}

pub fn update_bunker_data_query(bunker: &Bunker) -> Query<Postgres, PgArguments> {
    sqlx::query("UPDATE bunkers SET data = $2 WHERE id = $1")
        .bind(bunker.id)
        .bind(&bunker.data)
}
