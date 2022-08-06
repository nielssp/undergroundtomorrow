use chrono::Utc;
use rand::{
    seq::{IteratorRandom, SliceRandom},
    Rng,
};
use sqlx::PgPool;

use crate::{
    data::{ITEM_TYPES, LOCATION_TYPES},
    db::{
        expeditions,
        inhabitants::{self, SkillType},
        items, locations, messages,
        worlds::{self, WorldTime},
    },
    error,
    util::{get_sector_name, roll_dice, skill_roll},
};

pub fn start_loop(pool: PgPool) {
    actix_rt::spawn(async move {
        let mut interval = actix_rt::time::interval(std::time::Duration::from_secs(10));
        loop {
            interval.tick().await;
            tick(&pool).await.unwrap(); // TODO: error handling
        }
    });
}

pub async fn tick(pool: &PgPool) -> Result<(), error::Error> {
    let worlds = worlds::get_world_times(pool).await?;
    for world in &worlds {
        world_tick(pool, world).await?;
    }
    Ok(())
}

pub async fn world_tick(pool: &PgPool, world: &WorldTime) -> Result<(), error::Error> {
    let expeditions = expeditions::get_finished_expeditions(pool, world.id).await?;
    for expedition in expeditions {
        let sector_name = get_sector_name((expedition.zone_x, expedition.zone_y));
        let mut report_body = "".to_string();
        let mut team = inhabitants::get_by_expedition(pool, expedition.id).await?;
        let encounter_chances = expedition.data.distance / 2000;
        let mut retreat = false;
        if encounter_chances > 0 {
            if roll_dice(0.2, encounter_chances) {
                let stealth_sum: i32 = team
                    .iter()
                    .map(|i| inhabitants::get_inhabitant_skill_level(i, SkillType::Stealth))
                    .sum();
                let stealth_avg = (stealth_sum as f64 / team.len() as f64).ceil() as i32;
                if skill_roll(0.2, stealth_avg) {
                    report_body.push_str(&format!("Successfully evaded a band of marauders\n",));
                    for mut member in &mut team {
                        inhabitants::add_xp_to_skill(&mut member, SkillType::Stealth, 60);
                    }
                } else {
                    let quantity = rand::thread_rng().gen_range(1..10);
                    if quantity == 1 {
                        report_body.push_str(&format!("Encountered a single marauder\n"));
                    } else {
                        report_body.push_str(&format!("Encountered {} marauders\n", quantity));
                    }
                    let enemy_hp = 50;
                    let mut enemies = vec![enemy_hp, quantity];
                    enemies.iter_mut().for_each(|e| *e = 100);
                    let mut range = rand::thread_rng().gen_range(5..50);
                    for member in &mut team {
                        member.data.hp = 50;
                    }
                    for _ in 0..(range + 2) {
                        for mut member in &mut team {
                            if member.data.hp <= 0 {
                                continue;
                            }
                            let mut weapon_range = 1;
                            let mut weapon_damage = 1;
                            let skill = match &member.data.weapon_type {
                                Some(item_type) => {
                                    let weapon = ITEM_TYPES.get(item_type).ok_or_else(|| {
                                        error::internal_error("Item type not found")
                                    })?;
                                    if weapon.melee_weapon {
                                        weapon_range = weapon.range;
                                        weapon_damage = weapon.damage;
                                        SkillType::MeleeWeapons
                                    } else if member.data.ammo > 0 {
                                        weapon_range = weapon.range;
                                        weapon_damage = weapon.damage;
                                        SkillType::Guns
                                    } else {
                                        SkillType::Unarmed
                                    }
                                }
                                None => SkillType::Unarmed,
                            };
                            let hit_chance =
                                (weapon_range as f64 - range as f64 + 1.0) / (weapon_range as f64);
                            if hit_chance >= 0.1 {
                                if skill_roll(
                                    hit_chance,
                                    inhabitants::get_inhabitant_skill_level(member, skill),
                                ) {
                                    if let Some(enemy) = enemies.choose_mut(&mut rand::thread_rng())
                                    {
                                        let damage =
                                            rand::thread_rng().gen_range(1..weapon_damage + 1);
                                        *enemy -= damage;
                                        inhabitants::add_xp_to_skill(&mut member, skill, damage);
                                        report_body.push_str(&format!(
                                            "{} hit marauder for {} damage\n",
                                            member.name, damage
                                        ));
                                    }
                                } else {
                                    report_body
                                        .push_str(&format!("{} missed marauder\n", member.name));
                                }
                                if skill == SkillType::Guns {
                                    member.data.ammo -= 1;
                                    if member.data.ammo < 1 {
                                        report_body.push_str(&format!(
                                            "{} ran out of ammunition\n",
                                            member.name
                                        ));
                                    }
                                }
                            }
                        }
                        enemies.retain(|e| *e > 0);
                        if enemies.is_empty() {
                            if quantity == 1 {
                                report_body.push_str(&format!("Marauder was killed\n"));
                            } else {
                                report_body
                                    .push_str(&format!("All {} marauders were killed\n", quantity));
                            }
                            break;
                        }
                        for _ in &enemies {
                            // TODO: stats/abilities for marauders
                            let weapon_damage = 5;
                            let weapon_range = 15;
                            let hit_chance =
                                (weapon_range as f64 - range as f64 + 1.0) / (weapon_range as f64);
                            if hit_chance >= 0.1 {
                                if skill_roll(hit_chance, 0) {
                                    if let Some(member) = team
                                        .iter_mut()
                                        .filter(|m| m.data.hp > 0)
                                        .choose(&mut rand::thread_rng())
                                    {
                                        let damage =
                                            rand::thread_rng().gen_range(1..weapon_damage + 1);
                                        member.data.hp -= damage;
                                        report_body.push_str(&format!(
                                            "Marauder hit {} for {} damage\n",
                                            member.name, damage
                                        ));
                                        if member.data.hp < 0 {
                                            report_body.push_str(&format!(
                                                "{} was incapacitated\n",
                                                member.name
                                            ));
                                        }
                                    }
                                }
                            }
                        }
                        if !team.iter().any(|m| m.data.hp > 0) {
                            report_body.push_str(&format!("Retreated\n"));
                            retreat = true;
                            break;
                        }
                        if range > 0 {
                            range -= 1;
                        }
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
                    let scavenging_level =
                        inhabitants::get_inhabitant_skill_level(&member, SkillType::Scavenging);
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
                            if inhabitants::add_xp_to_skill(&mut member, SkillType::Scavenging, 60)
                            {
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
