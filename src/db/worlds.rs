use chrono::{DateTime, Utc, NaiveDateTime, Datelike, Timelike, NaiveDate, Duration};
use sqlx::{PgPool, Row};

use crate::error;

#[derive(serde::Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct World {
    pub id: i32,
    pub name: String,
    pub players: i64,
    pub open: bool,
    pub joined: bool,
    pub created: DateTime<Utc>,
    pub start_year: i32,
    pub time_acceleration: i32,
    pub time_offset: i32,
}

#[derive(serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct NewWorld {
    pub name: String,
    pub open: bool,
    pub start_year: i32,
    pub time_acceleration: i32,
    pub time_offset: i32,
}

pub async fn get_worlds(pool: &PgPool, user_id: i64) -> Result<Vec<World>, error::Error> {
    Ok(sqlx::query_as(
        "SELECT id, name, open, created, start_year, time_acceleration, time_offset, \
            (SELECT COUNT(*) FROM bunkers WHERE world_id = worlds.id) players, \
            EXISTS (SELECT 1 FROM bunkers WHERE world_id = worlds.id AND user_id = $1) joined \
            FROM worlds ORDER BY id DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?)
}

pub async fn get_world(pool: &PgPool, world_id: i32) -> Result<World, error::Error> {
    Ok(sqlx::query_as(
        "SELECT id, name, open, created, start_year, time_acceleration, time_offset, \
            (SELECT COUNT(*) FROM bunkers WHERE world_id = worlds.id) players, \
            EXISTS (SELECT 1 FROM bunkers WHERE world_id = worlds.id AND user_id = $1) joined \
            FROM worlds WHERE id = $1",
    )
    .bind(world_id)
    .fetch_one(pool)
    .await?)
}

pub async fn get_user_worlds(pool: &PgPool, user_id: i64) -> Result<Vec<World>, error::Error> {
    Ok(sqlx::query_as(
        "SELECT w.id, w.name, w.open, w.created, w.start_year, w.time_acceleration, time_offset, \
            (SELECT COUNT(*) FROM bunkers WHERE world_id = w.id) players, \
            true AS joined \
            FROM worlds w \
            INNER JOIN bunkers b ON b.world_id = w.id \
            WHERE b.user_id = $1 \
            ORDER BY w.created DESC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?)
}

pub async fn create_world(pool: &PgPool, data: &NewWorld) -> Result<i32, error::Error> {
    let id = sqlx::query(
        "INSERT INTO worlds (name, open, start_year, time_acceleration, time_offset, created) \
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(&data.name)
    .bind(data.open)
    .bind(data.start_year)
    .bind(data.time_acceleration)
    .bind(data.time_offset)
    .bind(Utc::now())
    .fetch_one(pool)
    .await?
    .try_get(0)?;
    Ok(id)
}

pub fn get_world_time(world: &World) -> NaiveDateTime {
    let duration = Utc::now().signed_duration_since(world.created);
    let date = NaiveDate::from_yo(world.start_year, world.created.ordinal());
    let start_time = NaiveDateTime::new(date, world.created.naive_utc().time());
    start_time + duration * world.time_acceleration + Duration::seconds(world.time_offset as i64)
}
