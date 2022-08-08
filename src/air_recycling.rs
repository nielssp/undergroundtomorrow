use rand::Rng;
use sqlx::PgPool;

use crate::{db::{inhabitants::{Assignment, Inhabitant, SkillType, self}, bunkers::Bunker, messages}, error, util::{skill_roll, roll_dice}};

pub async fn handle_tick(
    pool: &PgPool,
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
    power_level: i32,
) -> Result<i32, error::Error> {
    let workers: Vec<_> = inhabitants
        .iter_mut()
        .filter(|i| i.expedition_id.is_none() && i.data.assignment == Some(Assignment::AirRecycling))
        .collect();
    bunker.data.air_recycling.maintenance = (bunker.data.air_recycling.maintenance - 1).max(0);
    if bunker.data.air_recycling.malfunction {
        for mut inhabitant in workers {
            let level = inhabitants::get_inhabitant_skill_level(inhabitant, SkillType::Repair);
            if skill_roll(0.1, level) {
                bunker.data.air_recycling.malfunction = false;
                let improvement = rand::thread_rng().gen_range(1..5) + level;
                bunker.data.air_recycling.maintenance =
                    (bunker.data.air_recycling.maintenance + improvement).min(100);
                inhabitants::add_xp_to_skill(&mut inhabitant, SkillType::Repair, improvement * 10);
                inhabitant.changed = true;
            }
        }
        if !bunker.data.air_recycling.malfunction {
            messages::create_system_message(
                pool,
                &messages::NewSystemMessage {
                    receiver_bunker_id: bunker.id,
                    sender_name: format!("Air recycling team"),
                    subject: format!("Air recyling report"),
                    body: format!(
                        "The air recycling malfunction has been fixed. Air quality is back to normal."
                    ),
                },
            )
            .await?;
        }
    } else {
        for mut inhabitant in workers {
            let level = inhabitants::get_inhabitant_skill_level(inhabitant, SkillType::Repair);
            if skill_roll(0.1, level) {
                let improvement = rand::thread_rng().gen_range(1..5) + level;
                bunker.data.air_recycling.maintenance =
                    (bunker.data.air_recycling.maintenance + improvement).min(100);
                inhabitants::add_xp_to_skill(&mut inhabitant, SkillType::Repair, improvement * 10);
                inhabitant.changed = true;
            }
        }
        if roll_dice(0.01, 101 - bunker.data.air_recycling.maintenance * power_level / 100) {
            bunker.data.air_recycling.malfunction = true;
            messages::create_system_message(
                pool,
                &messages::NewSystemMessage {
                    receiver_bunker_id: bunker.id,
                    sender_name: format!("Air recycling warning system"),
                    subject: format!("Air recycling malfunction"),
                    body: format!(
                        "A malfunction has been detected in the air recycling system. Air quality is reduced."
                    ),
                },
            )
            .await?;
        }
    }
    let mut air_quality = 100;
    if bunker.data.air_recycling.malfunction {
        air_quality /= 2;
    }
    Ok(air_quality)
}

