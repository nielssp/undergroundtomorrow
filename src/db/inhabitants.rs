use chrono::{Date, NaiveDate, Utc};
use itertools::Itertools;
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
pub enum SkillType {
    Combat,
    HandToHand,
    Guns,
    Science,
    Reactor,
    Botany,
    Medicine,
    FirstAid,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub skill_type: SkillType,
    pub level: i32,
    pub xp: i32,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InhabitantData {
    #[serde(default)]
    pub skills: Vec<Skill>,
}

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

pub async fn get_available_inhabitants(
    pool: &PgPool,
    bunker_id: i32,
    inhabitant_ids: &Vec<i32>,
) -> Result<Vec<i32>, error::Error> {
    if inhabitant_ids.is_empty() {
        return Ok(vec![]);
    }
    let params = (0..inhabitant_ids.len())
        .map(|i| format!("${}", i + 2))
        .join(", ");
    let query_str = format!("SELECT i.id FROM inhabitants i \
        WHERE i.bunker_id = $1 AND i.id IN ( { } ) AND i.expedition_id IS NULL", params);

    let mut query = sqlx::query(&query_str).bind(bunker_id);
    for design_id in inhabitant_ids {
        query = query.bind(design_id);
    }
    Ok(query.try_map(|row| row.try_get("id")).fetch_all(pool).await?)
}

pub async fn attach_to_expedition(
    pool: &PgPool,
    bunker_id: i32,
    expedition_id: i32,
    inhabitant_ids: &Vec<i32>,
) -> Result<bool, error::Error> {
    if inhabitant_ids.is_empty() {
        return Ok(false);
    }
    let params = (0..inhabitant_ids.len())
        .map(|i| format!("${}", i + 3))
        .join(", ");
    let query_str = format!("UPDATE inhabitants SET expedition_id = $1 \
        WHERE bunker_id = $2 AND id IN ( { } ) AND expedition_id IS NULL", params);

    let mut query = sqlx::query(&query_str)
        .bind(expedition_id)
        .bind(bunker_id);
    for design_id in inhabitant_ids {
        query = query.bind(design_id);
    }
    Ok(query.execute(pool).await?.rows_affected() > 0)
}

pub fn get_skill_level(xp: i32) -> i32 {
    ((xp as f64) / 50.0 + 1.0).log2() as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn can_get_skill_level() {
        assert_eq!(0, get_skill_level(0));
        assert_eq!(0, get_skill_level(49));
        assert_eq!(1, get_skill_level(50));
        assert_eq!(1, get_skill_level(149));
        assert_eq!(2, get_skill_level(150));
    }
}