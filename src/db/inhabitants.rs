use chrono::{Date, NaiveDate, Utc};
use sqlx::{types::Json, PgPool, Row};

use crate::error;

#[derive(sqlx::FromRow, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inhabitant {
    pub id: i32,
    pub bunker_id: i32,
    pub expedition_id: Option<i32>,
    pub name: String,
    pub date_of_birth: NaiveDate,
    pub data: Json<InhabitantData>,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InhabitantData {}

pub struct NewInhabitant {
    pub name: String,
    pub date_of_birth: NaiveDate,
    pub data: InhabitantData,
}

pub async fn create_inhabitant(
    pool: &PgPool,
    bunker_id: i32,
    inhabitant: &NewInhabitant,
) -> Result<i32, error::Error> {
    Ok(sqlx::query(
        "INSERT INTO inhabitants (bunker_id, expedition_id, name, date_of_birth, data) \
        VALUES ($1, NULL, $2, $3, $4) RETURNING id",
    )
    .bind(bunker_id)
    .bind(&inhabitant.name)
    .bind(inhabitant.date_of_birth)
    .bind(Json(&inhabitant.data))
    .fetch_one(pool)
    .await?
    .try_get(0)?)
}

pub async fn get_inhabitants(
    pool: &PgPool,
    bunker_id: i32,
) -> Result<Vec<Inhabitant>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM inhabitants WHERE bunker_id = $1 ORDER BY name ASC")
            .bind(bunker_id)
            .fetch_all(pool)
            .await?,
    )
}
