use std::collections::HashMap;

use chrono::{Duration, Utc};
use itertools::Itertools;
use sqlx::PgPool;

use crate::{
    data::ITEM_TYPES,
    db::{
        bunkers::Bunker,
        expeditions, inhabitants,
        items::{self, Item},
        locations, worlds,
    },
    error, util,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamMember {
    inhabitant_id: i32,
    weapon_type: Option<String>,
    ammo: i32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpeditionRequest {
    zone_x: i32,
    zone_y: i32,
    location_id: Option<i32>,
    team: Vec<TeamMember>,
}

pub async fn create(
    pool: &PgPool,
    world_id: i32,
    bunker: &Bunker,
    mut request: ExpeditionRequest,
) -> Result<(), error::Error> {
    if let Some(location_id) = request.location_id {
        if !locations::is_location_discovered(&pool, bunker.id, location_id).await? {
            request.location_id = None;
        }
    }
    if request.zone_x < 0 || request.zone_x >= 26 || request.zone_y < 0 || request.zone_y >= 26 {
        Err(error::client_error("INVALID_ZONE"))?;
    }
    let distance = util::get_distance(
        (bunker.x, bunker.y),
        (request.zone_x * 100 + 50, request.zone_y * 100 + 50),
    );
    let world_time = worlds::get_world_time(&pool, world_id).await?;
    let inhabitant_ids = request.team.iter().map(|m| m.inhabitant_id).collect_vec();
    let mut inhabitants =
        inhabitants::get_inhabitants_by_id(pool, bunker.id, &inhabitant_ids).await?;
    let mut item_types: Vec<String> = vec![];
    for member in &request.team {
        if let Some(weapon_type_id) = &member.weapon_type {
            let weapon_type = ITEM_TYPES
                .get(weapon_type_id)
                .ok_or_else(|| error::client_error("INVALID_WEAPON_TYPE"))?;
            item_types.push(weapon_type_id.clone());
            if let Some(ammo_type_id) = &weapon_type.ammo_type {
                item_types.push(ammo_type_id.clone());
            }
        }
    }
    let mut items: HashMap<String, (i32, i32)> =
        items::get_items_by_id(pool, bunker.id, item_types)
            .await?
            .into_iter()
            .map(|i| (i.item_type, (i.quantity, 0)))
            .collect();
    for inhabintant in &mut inhabitants {
        let member = request
            .team
            .iter()
            .find(|m| m.inhabitant_id == inhabintant.id)
            .ok_or_else(|| error::internal_error("Inhabitant not in list"))?;
        if let Some(weapon_type_id) = &member.weapon_type {
            let item = items
                .get_mut(weapon_type_id)
                .filter(|i| i.0 > 0)
                .ok_or_else(|| error::client_error("WEAPON_TYPE_MISSING"))?;
            item.0 -= 1;
            item.1 += 1;
            let weapon_type = ITEM_TYPES
                .get(weapon_type_id)
                .ok_or_else(|| error::client_error("INVALID_WEAPON_TYPE"))?;
            inhabintant.data.weapon_type = Some(weapon_type_id.clone());
            if let Some(ammo_type_id) = &weapon_type.ammo_type {
                let item = items
                    .get_mut(ammo_type_id)
                    .filter(|i| i.0 >= member.ammo)
                    .ok_or_else(|| error::client_error("WEAPON_TYPE_MISSING"))?;
                item.0 -= member.ammo;
                item.1 += member.ammo;
                inhabintant.data.ammo = member.ammo;
            } else {
                inhabintant.data.ammo = 0;
            }
        } else {
            inhabintant.data.weapon_type = None;
            inhabintant.data.ammo = 0;
        }
    }
    let speed = 5 * 1000 / 60;
    let duration =
        Duration::minutes((10 + 2 * distance / speed) as i64) / world_time.time_acceleration;
    let eta = Utc::now() + duration;
    let new_expedition = expeditions::NewExpedition {
        bunker_id: bunker.id,
        location_id: request.location_id,
        zone_x: request.zone_x,
        zone_y: request.zone_y,
        eta,
        data: expeditions::ExpeditionData { distance },
    };
    let mut tx = pool.begin().await?;
    let expedition_id = expeditions::create_expedition(&pool, &new_expedition).await?;
    for (item_type, (_, needed)) in items {
        if needed > 0 {
            let affected = items::remove_items_query(bunker.id, &item_type, needed)
                .execute(&mut tx)
                .await?
                .rows_affected();
            if affected < 1 {
                Err(error::client_error("ITEM_UNAVAILABLE"))?;
            }
        }
    }
    for inhabitant in &inhabitants {
        let affected = inhabitants::attach_to_expedition_query(inhabitant.id, expedition_id)
            .execute(&mut tx)
            .await?
            .rows_affected();
        if affected < 1 {
            Err(error::client_error("INHABITANT_UNAVAILABLE"))?;
        }
        inhabitants::update_inhabitant_data_query(inhabitant)
            .execute(&mut tx)
            .await?;
    }
    tx.commit().await?;
    items::remove_empty_items(pool, bunker.id).await?;
    Ok(())
}
