use chrono::{DateTime, NaiveDate, Utc};

use crate::{
    data::{get_item_type, ItemType},
    db::{
        bunkers::{
            AirRecyclingStatus, Bunker, CafeteriaStatus, HorticultureStatus, InfirmaryStatus,
            ReactorStatus, WaterTreatmentStatus, WorkshopStatus,
        },
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
    pub skills: Vec<Skill>,
    pub assignment: Option<Assignment>,
    pub team: Option<String>,
    pub weapon_type: Option<String>,
    pub ammo: i32,
    pub bleeding: bool,
    pub wounded: bool,
    pub sick: bool,
    pub infection: bool,
    pub recovering: bool,
    pub starving: bool,
    pub sleeping: bool,
    pub ready: bool,
    pub health: i32,
}

impl From<Inhabitant> for InhabitantDto {
    fn from(source: Inhabitant) -> InhabitantDto {
        let ready = source.is_ready();
        let data = source.data.0;
        InhabitantDto {
            id: source.id,
            expedition_id: source.expedition_id,
            name: source.name,
            date_of_birth: source.date_of_birth,
            skills: data.skills,
            assignment: data.assignment,
            team: data.team,
            weapon_type: data.weapon_type,
            ammo: data.ammo,
            bleeding: data.bleeding,
            wounded: data.wounded,
            sick: data.sick,
            infection: data.infection,
            recovering: data.recovering,
            starving: data.starving,
            sleeping: data.sleeping,
            ready,
            health: data.health,
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

#[derive(serde::Serialize)]
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BunkerDto {
    pub id: i32,
    pub number: i32,
    pub x: i32,
    pub y: i32,
    pub broadcast_id: String,
    pub reactor: ReactorStatus,
    pub water_treatment: WaterTreatmentStatus,
    pub infirmary: InfirmaryStatus,
    pub workshop: WorkshopStatus,
    pub horticulture: HorticultureStatus,
    pub air_recycling: AirRecyclingStatus,
    pub cafeteria: CafeteriaStatus,
}

impl From<Bunker> for BunkerDto {
    fn from(source: Bunker) -> BunkerDto {
        let data = source.data.0;
        BunkerDto {
            id: source.id,
            number: source.number,
            x: source.x,
            y: source.y,
            broadcast_id: source.broadcast_id,
            reactor: data.reactor,
            water_treatment: data.water_treatment,
            infirmary: data.infirmary,
            workshop: data.workshop,
            horticulture: data.horticulture,
            air_recycling: data.air_recycling,
            cafeteria: data.cafeteria,
        }
    }
}
