use sqlx::{types::Json, PgPool, Row};

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
    pub data: Json<BunkerData>,
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BunkerData {}

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
