use sqlx::{types::Json, PgPool, Row};

use crate::error;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationData {
    pub location_type: String,
    #[serde(default)]
    pub abundance: f64,
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

#[derive(serde::Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Sector {
    pub x: i32,
    pub y: i32,
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

pub async fn add_all_bunker_locations_in_sector(
    pool: &PgPool,
    world_id: i32,
    bunker_id: i32,
    sector: (i32, i32),
) -> Result<(), error::Error> {
    sqlx::query(
        "INSERT INTO bunker_locations (bunker_id, location_id) SELECT $1, id FROM locations \
        WHERE x BETWEEN $2 AND $3 AND y BETWEEN $4 AND $5 AND world_id = $5 \
        ON CONFLICT DO NOTHING",
    )
    .bind(bunker_id)
    .bind(sector.0 * 100)
    .bind(sector.0 * 100 + 99)
    .bind(sector.1 * 100)
    .bind(sector.1 * 100 + 99)
    .bind(world_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn add_bunker_sector(
    pool: &PgPool,
    bunker_id: i32,
    x: i32,
    y: i32,
) -> Result<(), error::Error> {
    sqlx::query(
        "INSERT INTO bunker_sectors (bunker_id, x, y) VALUES ($1, $2, $3) \
        ON CONFLICT DO NOTHING",
    )
    .bind(bunker_id)
    .bind(x)
    .bind(y)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_undiscovered_locations(
    pool: &PgPool,
    bunker_id: i32,
    x: i32,
    y: i32,
) -> Result<Vec<Location>, error::Error> {
    Ok(sqlx::query_as(
        "SELECT l.* FROM locations l \
        WHERE l.id NOT IN (SELECT bl.location_id FROM bunker_locations bl WHERE bl.bunker_id = $1) \
        AND x BETWEEN $2 AND $3 AND y BETWEEN $4 AND $5 \
        AND l.world_id = (SELECT world_id FROM bunkers WHERE id = $1)",
    )
    .bind(bunker_id)
    .bind(x * 100)
    .bind(x * 100 + 99)
    .bind(y * 100)
    .bind(y * 100 + 99)
    .fetch_all(pool)
    .await?)
}

pub async fn get_discovered_locations(
    pool: &PgPool,
    bunker_id: i32,
) -> Result<Vec<Location>, error::Error> {
    Ok(sqlx::query_as(
        "SELECT l.* FROM locations l INNER JOIN bunker_locations bl ON bl.location_id = l.id \
        WHERE bl.bunker_id = $1",
    )
    .bind(bunker_id)
    .fetch_all(pool)
    .await?)
}

pub async fn get_explored_sectors(
    pool: &PgPool,
    bunker_id: i32,
) -> Result<Vec<Sector>, error::Error> {
    Ok(
        sqlx::query_as("SELECT x, y FROM bunker_sectors WHERE bunker_id = $1")
            .bind(bunker_id)
            .fetch_all(pool)
            .await?,
    )
}

pub async fn is_location_discovered(
    pool: &PgPool,
    bunker_id: i32,
    location_id: i32,
) -> Result<bool, error::Error> {
    Ok(
        sqlx::query("SELECT 1 FROM bunker_locations WHERE bunker_id = $1 AND location_id = $2")
            .bind(bunker_id)
            .bind(location_id)
            .fetch_optional(pool)
            .await?
            .is_some(),
    )
}

pub async fn get_location(pool: &PgPool, location_id: i32) -> Result<Location, error::Error> {
    Ok(sqlx::query_as("SELECT * FROM locations WHERE id = $1")
        .bind(location_id)
        .fetch_one(pool)
        .await?)
}

pub fn get_distance(a: (i32, i32), b: (i32, i32)) -> i32 {
    let delta_x = a.0 - b.0;
    let delta_y = a.1 - b.1;
    ((delta_x * delta_x + delta_y * delta_y) as f64).sqrt() as i32
}
