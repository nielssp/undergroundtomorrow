use chrono::NaiveDate;

use crate::db::inhabitants::{Inhabitant, Skill};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InhabitantDto {
    pub id: i32,
    pub expedition_id: Option<i32>,
    pub name: String,
    pub date_of_birth: NaiveDate,
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
            skills: data.skills,
            assignment: data.assignment,
            team: data.team,
        }
    }
}
