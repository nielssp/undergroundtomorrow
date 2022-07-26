use sqlx::{types::Json, PgPool, Row};

use crate::error;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationData {
    // abundance / chance of finding loot, lowers (for everyone) after each expedition
    // accessibility: ...
    // loot table
}

#[derive(serde::Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    pub id: i32,
    pub world_id: i32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub data: Json<LocationData>,
}

pub struct NewLocation {
    pub world_id: i32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub data: LocationData,
}

pub async fn create_location(pool: &PgPool, location: &NewLocation) -> Result<i32, error::Error> {
    Ok(sqlx::query(
        "INSERT INTO locations (world_id, name, x, y, data) VALUES ($1, $2, $3, $4, $5) RETURNING id"
    )
        .bind(location.world_id)
        .bind(&location.name)
        .bind(location.x)
        .bind(location.y)
        .bind(Json(&location.data))
        .fetch_one(pool)
        .await?
        .try_get(0)?)
}

pub async fn add_bunker_location(
    pool: &PgPool,
    bunker_id: i32,
    location_id: i32,
) -> Result<(), error::Error> {
    sqlx::query(
        "INSERT INTO bunker_locations (bunker_id, location_id) VALUES ($1, $2) \
        ON CONFLICT DO NOTHING",
    )
    .bind(bunker_id)
    .bind(location_id)
    .execute(pool)
    .await?;
    Ok(())
}
