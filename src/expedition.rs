use std::collections::HashMap;

use actix::Addr;
use chrono::{Duration, Utc};
use itertools::Itertools;
use rand::Rng;
use sqlx::PgPool;

use crate::{
    battle,
    data::{ITEM_TYPES, LOCATION_TYPES},
    db::{
        bunkers::Bunker,
        expeditions,
        inhabitants::{self, get_age, SkillType},
        items, locations, messages,
        worlds::{self, WorldTime},
    },
    error,
    util::{self, get_sector_name, roll_dice, skill_roll}, broadcaster::{Broadcaster, BunkerMessage},
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
        if get_age(world_time.now(), inhabintant.date_of_birth) < 16 {
            Err(error::client_error("INHABITANT_TOO_YOUNG"))?;
        }
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
                if member.ammo > 0 {
                    let item = items
                        .get_mut(ammo_type_id)
                        .filter(|i| i.0 >= member.ammo)
                        .ok_or_else(|| error::client_error("AMMO_TYPE_MISSING"))?;
                    item.0 -= member.ammo;
                    item.1 += member.ammo;
                    inhabintant.data.ammo = member.ammo;
                } else {
                    inhabintant.data.ammo = 0;
                }
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

pub async fn handle_finished_expeditions(
    pool: &PgPool,
    world: &WorldTime,
    broadcaster: &Addr<Broadcaster>,
) -> Result<(), error::Error> {
    let expeditions = expeditions::get_finished_expeditions(pool, world.id).await?;
    for expedition in expeditions {
        let sector_name = get_sector_name((expedition.zone_x, expedition.zone_y));
        let mut report_body = "".to_string();
        let mut team = inhabitants::get_by_expedition(pool, expedition.id).await?;
        let encounter_chances = expedition.data.distance / 2000 * 2;
        let mut retreat = false;
        if encounter_chances > 0 {
            if roll_dice(0.2, encounter_chances) {
                if !battle::encounter(&mut team, &mut report_body, encounter_chances)? {
                    retreat = true;
                }
                let mut first_aid_applied: Vec<(i32, i32)> = vec![];
                for wounded in &team {
                    if !wounded.data.wounded && !wounded.data.bleeding {
                        continue;
                    }
                    for member in &team {
                        if member.id == wounded.id {
                            continue;
                        }
                        let first_aid = member.get_skill_level(SkillType::FirstAid);
                        let medicine = member.get_skill_level(SkillType::Medicine);
                        if skill_roll(0.1, first_aid + medicine) {
                            first_aid_applied.push((wounded.id, member.id));
                            report_body.push_str(&format!(
                                "{} successfully applied first aid to {}\n",
                                member.name, wounded.name
                            ));
                        }
                    }
                }
                for member in &mut team {
                    for (recipient_id, other_id) in &first_aid_applied {
                        if *recipient_id == member.id {
                            member.data.bleeding = false;
                        } else if *other_id == member.id {
                            member.add_xp(SkillType::FirstAid, 50);
                        }
                    }
                    if member.data.bleeding && !retreat {
                        report_body.push_str(&format!("Returned with wounded\n"));
                        retreat = true;
                    }
                }
            }
        }
        if !retreat {
            if let Some(location_id) = expedition.location_id {
                let location = locations::get_location(pool, location_id).await?;
                report_body.push_str(&format!(
                    "Successfully explored {} in sector {}\n",
                    location.name, sector_name
                ));
                let location_type = LOCATION_TYPES
                    .get(&location.data.location_type)
                    .ok_or_else(|| error::internal_error("Unknown location type"))?;
                for mut member in &mut team {
                    let scavenging_level = member.get_skill_level(SkillType::Scavenging);
                    for (item_type_id, entry) in &location_type.loot {
                        if skill_roll(entry.chance, scavenging_level) {
                            let item_type = ITEM_TYPES
                                .get(item_type_id)
                                .ok_or_else(|| error::internal_error("Item type not found"))?;
                            let quantity = rand::thread_rng().gen_range(entry.min..entry.max + 1);
                            if quantity == 1 {
                                report_body.push_str(&format!("Found {}\n", &item_type.name));
                            } else {
                                report_body.push_str(&format!(
                                    "Found {} ({})\n",
                                    &item_type.name_plural, quantity
                                ));
                            }
                            items::add_item(pool, expedition.bunker_id, item_type_id, quantity)
                                .await?;
                            if member.add_xp(SkillType::Scavenging, 60) {
                                report_body.push_str(&format!(
                                    "{} got better at scavening\n",
                                    member.name
                                ));
                            }
                        }
                    }
                }
            } else {
                let locations = locations::get_undiscovered_locations(
                    pool,
                    expedition.bunker_id,
                    expedition.zone_x,
                    expedition.zone_y,
                )
                .await?;
                let mut discovered = 0;
                for location in &locations {
                    for member in &team {
                        let exploration_level = inhabitants::get_inhabitant_skill_level(
                            &member,
                            SkillType::Exploration,
                        );
                        if skill_roll(0.25, exploration_level) {
                            discovered += 1;
                            report_body.push_str(&format!(
                                "Location discovered in sector {}: {}\n",
                                sector_name, location.name
                            ));
                            locations::add_bunker_location(pool, expedition.bunker_id, location.id)
                                .await?;
                            break;
                        }
                    }
                }
                if discovered == 0 {
                    report_body.push_str("No new locations discovered");
                } else {
                    let xp = discovered * 40;
                    for mut member in &mut team {
                        if inhabitants::add_xp_to_skill(&mut member, SkillType::Exploration, xp) {
                            report_body
                                .push_str(&format!("{} got better at exploration\n", member.name));
                        }
                    }
                }
                if discovered >= locations.len() as i32 {
                    for member in &team {
                        let exploration_level = inhabitants::get_inhabitant_skill_level(
                            &member,
                            SkillType::Exploration,
                        );
                        if skill_roll(0.25, exploration_level) {
                            locations::add_bunker_sector(
                                pool,
                                expedition.bunker_id,
                                expedition.zone_x,
                                expedition.zone_y,
                            )
                            .await?;
                            break;
                        }
                    }
                }
            }
        }
        let exposure =
            ((Utc::now() - expedition.created) * world.time_acceleration).num_hours() as i32;
        for member in &mut team {
            member.data.surface_exposure += exposure;
            inhabitants::update_inhabitant_data(pool, &member).await?;
            if let Some(weapon_type_id) = &member.data.weapon_type {
                items::add_item(pool, expedition.bunker_id, &weapon_type_id, 1).await?;
                let weapon_type = ITEM_TYPES
                    .get(weapon_type_id)
                    .ok_or_else(|| error::client_error("INVALID_WEAPON_TYPE"))?;
                if let Some(ammo_type_id) = &weapon_type.ammo_type {
                    if member.data.ammo > 0 {
                        items::add_item(
                            pool,
                            expedition.bunker_id,
                            &ammo_type_id,
                            member.data.ammo,
                        )
                        .await?;
                    }
                }
            }
        }
        broadcaster.do_send(BunkerMessage { bunker_id: expedition.bunker_id, message: "EXPEDITION".to_owned() });
        messages::create_system_message(
            pool,
            &messages::NewSystemMessage {
                receiver_bunker_id: expedition.bunker_id,
                sender_name: format!("Mission team"),
                subject: format!("Mission report (Sector {})", sector_name),
                body: report_body,
            },
        )
        .await?;
        expeditions::delete_expedition(pool, expedition.id).await?;
    }
    Ok(())
}
