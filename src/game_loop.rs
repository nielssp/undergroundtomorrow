use rand::Rng;
use sqlx::PgPool;

use crate::{
    data::LOCATION_TYPES,
    db::{expeditions, items, locations, messages, inhabitants::{self, SkillType}},
    error, util::{skill_roll, get_sector_name},
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
    let expeditions = expeditions::get_finished_expeditions(pool).await?;
    for expedition in expeditions {
        let sector_name = get_sector_name((expedition.zone_x, expedition.zone_y));
        let mut report_body = "".to_string();
        let mut team = inhabitants::get_by_expedition(pool, expedition.id).await?;
        if let Some(location_id) = expedition.location_id {
            let location = locations::get_location(pool, location_id).await?;
            report_body.push_str(&format!("Successfully explored {} in sector {}\n", location.name, sector_name));
            let location_type = LOCATION_TYPES
                .get(&location.data.location_type)
                .ok_or_else(|| error::internal_error("Unknown location type"))?;
            for mut member in team {
                let mut update = false;
                let scavenging_level = inhabitants::get_inhabitant_skill_level(&member, SkillType::Scavenging);
                for (item_type, entry) in &location_type.loot {
                    if skill_roll(entry.chance, scavenging_level) {
                        let quantity = rand::thread_rng().gen_range(entry.min..entry.max + 1);
                        report_body.push_str(&format!("Found {} ({})\n", item_type, quantity));
                        items::add_item(pool, expedition.bunker_id, item_type, quantity).await?;
                        if inhabitants::add_xp_to_skill(&mut member, SkillType::Scavenging, 60) {
                            report_body.push_str(&format!("{} got better at scavening\n", member.name));
                        }
                        update = true;
                    }
                }
                if update {
                    inhabitants::update_inhabitant_data(pool, &member).await?;
                }
            }
        } else {
            let locations = locations::get_undiscovered_locations(pool, expedition.bunker_id, expedition.zone_x, expedition.zone_y).await?;
            let mut discovered = 0;
            for location in &locations {
                for member in &team {
                    let exploration_level = inhabitants::get_inhabitant_skill_level(&member, SkillType::Exploration);
                    if skill_roll(0.25, exploration_level) {
                        discovered += 1;
                        report_body.push_str(&format!("Location discovered in sector {}: {}\n", sector_name, location.name));
                        locations::add_bunker_location(pool, expedition.bunker_id, location.id).await?;
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
                        report_body.push_str(&format!("{} got better at exploration\n", member.name));
                    }
                    inhabitants::update_inhabitant_data(pool, &member).await?;
                }
            }
            if discovered >= locations.len() as i32 {
                for member in &team {
                    let exploration_level = inhabitants::get_inhabitant_skill_level(&member, SkillType::Exploration);
                    if skill_roll(0.25, exploration_level) {
                        locations::add_bunker_sector(pool, expedition.bunker_id, expedition.zone_x, expedition.zone_y).await?;
                        break;
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
