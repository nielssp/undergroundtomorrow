use chrono::NaiveDate;

use crate::db::{inhabitants::{Inhabitant, Skill}, locations::Location};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InhabitantDto {
    pub id: i32,
    pub expedition_id: Option<i32>,
    pub name: String,
    pub date_of_birth: NaiveDate,
    pub health: i32,
    pub skills: Vec<Skill>,
    pub assignment: Option<String>,
    pub team: Option<String>,
}

impl From<Inhabitant> for InhabitantDto {
    fn from(source: Inhabitant) -> InhabitantDto {
        let data = source.data.0;
        InhabitantDto {
            id: source.id,
            expedition_id: source.expedition_id,
            name: source.name,
            date_of_birth: source.date_of_birth,
            health: data.health,
            skills: data.skills,
            assignment: data.assignment,
            team: data.team,
        }
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationDto {
    pub id: i32,
    pub world_id: i32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub location_type: String,
}

impl From<Location> for LocationDto {
    fn from(source: Location) -> LocationDto {
        let data = source.data.0;
        LocationDto {
            id: source.id,
            world_id: source.world_id,
            name: source.name,
            x: source.x,
            y: source.y,
            location_type: data.location_type,
        }
    }
}
