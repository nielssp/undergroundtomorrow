use chrono::{DateTime, NaiveDate, Utc};

use crate::{
    data::{get_item_type, ItemType},
    db::{
        expeditions::Expedition,
        inhabitants::{Assignment, Inhabitant, Skill},
        items::Item,
        locations::Location,
    },
};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InhabitantDto {
    pub id: i32,
    pub expedition_id: Option<i32>,
    pub name: String,
    pub date_of_birth: NaiveDate,
    pub health: i32,
    pub skills: Vec<Skill>,
    pub assignment: Option<Assignment>,
    pub team: Option<String>,
    pub weapon_type: Option<String>,
    pub ammo: i32,
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
            weapon_type: data.weapon_type,
            ammo: data.ammo,
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemDto {
    pub id: i32,
    pub item_type: ItemType,
    pub quantity: i32,
}

impl From<Item> for ItemDto {
    fn from(source: Item) -> ItemDto {
        ItemDto {
            id: source.id,
            item_type: get_item_type(&source.item_type),
            quantity: source.quantity,
        }
    }
}

#[derive(serde::Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ExpeditionDto {
    pub id: i32,
    pub location_id: Option<i32>,
    pub zone_x: i32,
    pub zone_y: i32,
    pub eta: DateTime<Utc>,
    pub created: DateTime<Utc>,
    pub distance: i32,
}

impl From<Expedition> for ExpeditionDto {
    fn from(source: Expedition) -> ExpeditionDto {
        let data = source.data.0;
        ExpeditionDto {
            id: source.id,
            location_id: source.location_id,
            zone_x: source.zone_x,
            zone_y: source.zone_y,
            eta: source.eta,
            created: source.created,
            distance: data.distance,
        }
    }
}
