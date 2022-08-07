use chrono::{Date, Datelike, NaiveDate, NaiveDateTime, Utc};
use itertools::Itertools;
use sqlx::{postgres::PgArguments, query::Query, types::Json, PgPool, Postgres, Row};

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

#[derive(serde::Serialize, serde::Deserialize, PartialEq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub enum SkillType {
    Combat,
    Science,
    Reactor,
    Botany,
    Medicine,
    FirstAid,
    Scavenging,
    Exploration,
    Repair,
    Cooking,
    Stealth,
    Movement,
    MeleeWeapons,
    Guns,
    Unarmed,
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub skill_type: SkillType,
    pub level: i32,
    pub xp: i32,
}

#[derive(serde::Serialize, serde::Deserialize, PartialEq, Copy, Clone)]
#[serde(rename_all = "camelCase")]
pub enum Assignment {
    Reactor,
    Infirmary,
    Horticulture,
    Workshop,
    WaterTreatment,
    Maintenance,
    Cafeteria,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InhabitantData {
    #[serde(default)]
    pub health: i32,
    #[serde(default)]
    pub skills: Vec<Skill>,
    #[serde(default)]
    pub assignment: Option<Assignment>,
    #[serde(default)]
    pub team: Option<String>,
    #[serde(default)]
    pub surface_exposure: i32,
    #[serde(default)]
    pub weapon_type: Option<String>,
    #[serde(default)]
    pub ammo: i32,
    #[serde(default)]
    pub hp: i32, // TODO: wounded state
    #[serde(default)]
    pub energy: i32, // TODO: sleep state etc
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

pub async fn get_inhabitant(
    pool: &PgPool,
    bunker_id: i32,
    inhabitant_id: i32,
) -> Result<Option<Inhabitant>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM inhabitants WHERE bunker_id = $1 AND id = $2")
            .bind(bunker_id)
            .bind(inhabitant_id)
            .fetch_optional(pool)
            .await?,
    )
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

pub async fn get_by_expedition(
    pool: &PgPool,
    expedition_id: i32,
) -> Result<Vec<Inhabitant>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM inhabitants WHERE expedition_id = $1")
            .bind(expedition_id)
            .fetch_all(pool)
            .await?,
    )
}

pub async fn get_inhabitants_by_id(
    pool: &PgPool,
    bunker_id: i32,
    inhabitant_ids: &Vec<i32>,
) -> Result<Vec<Inhabitant>, error::Error> {
    if inhabitant_ids.is_empty() {
        return Ok(vec![]);
    }
    let params = (0..inhabitant_ids.len())
        .map(|i| format!("${}", i + 2))
        .join(", ");
    let query_str = format!(
        "SELECT * FROM inhabitants i \
        WHERE i.bunker_id = $1 AND i.id IN ( { } )",
        params
    );

    let mut query = sqlx::query_as(&query_str).bind(bunker_id);
    for inhabitant_id in inhabitant_ids {
        query = query.bind(inhabitant_id);
    }
    Ok(query.fetch_all(pool).await?)
}

pub fn update_inhabitant_data_query(inhabitant: &Inhabitant) -> Query<Postgres, PgArguments> {
    sqlx::query("UPDATE inhabitants SET data = $2 WHERE id = $1")
        .bind(inhabitant.id)
        .bind(Json(&inhabitant.data))
}

pub fn attach_to_expedition_query(
    inhabitant_id: i32,
    expedition_id: i32,
) -> Query<'static, Postgres, PgArguments> {
    sqlx::query("UPDATE inhabitants SET expedition_id = $2 WHERE id = $1 AND expedition_id IS NULL")
        .bind(inhabitant_id)
        .bind(expedition_id)
}

pub async fn update_inhabitant_data(
    pool: &PgPool,
    inhabitant: &Inhabitant,
) -> Result<(), error::Error> {
    update_inhabitant_data_query(inhabitant)
        .execute(pool)
        .await?;
    Ok(())
}

pub fn get_inhabitant_skill_level(inhabitant: &Inhabitant, skill_type: SkillType) -> i32 {
    get_skill_level(
        inhabitant
            .data
            .skills
            .iter()
            .find(|s| s.skill_type == skill_type)
            .map(|s| s.xp)
            .unwrap_or_else(|| 0),
    )
}

pub fn add_xp_to_skill(inhabitant: &mut Inhabitant, skill_type: SkillType, xp: i32) -> bool {
    let existing = inhabitant
        .data
        .skills
        .iter_mut()
        .find(|s| s.skill_type == skill_type);
    if let Some(mut skill) = existing {
        skill.xp += xp;
        let previous_level = skill.level;
        skill.level = get_skill_level(skill.xp);
        return skill.level > previous_level;
    } else {
        let new = Skill {
            skill_type,
            xp,
            level: get_skill_level(xp),
        };
        let level_up = new.level > 0;
        inhabitant.data.skills.push(new);
        return level_up;
    }
}

pub fn get_skill_level(xp: i32) -> i32 {
    ((xp as f64) / 50.0 + 1.0).log2() as i32
}

pub fn get_age(now: NaiveDateTime, dob: NaiveDate) -> i32 {
    let date = now.date();
    let age = date.year() - dob.year();
    if let Some(adjusted_date) = date.with_year(dob.year()).or_else(|| {
        date.with_day(date.day() - 1)
            .map(|d| d.with_year(dob.year()))
            .flatten()
    }) {
        if adjusted_date < dob {
            age - 1
        } else {
            age
        }
    } else {
        age
    }
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

    #[test]
    fn can_get_get() {
        let now = NaiveDate::from_ymd(2070, 06, 01).and_hms(12, 0, 0);
        assert_eq!(0, get_age(now, NaiveDate::from_ymd(2069, 06, 02)));
        assert_eq!(1, get_age(now, NaiveDate::from_ymd(2069, 06, 01)));
        assert_eq!(2, get_age(now, NaiveDate::from_ymd(2068, 06, 01)));
        let now = NaiveDate::from_ymd(2020, 02, 29).and_hms(12, 0, 0);
        assert_eq!(9, get_age(now, NaiveDate::from_ymd(2010, 03, 01)));
        assert_eq!(10, get_age(now, NaiveDate::from_ymd(2010, 02, 28)));
        assert_eq!(8, get_age(now, NaiveDate::from_ymd(2012, 02, 29)));
    }
}
