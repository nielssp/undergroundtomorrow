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
        .filter(|i| i.expedition_id.is_none() && i.data.assignment == Some(Assignment::WaterTreatment))
        .collect();
    bunker.data.water_treatment.maintenance = (bunker.data.water_treatment.maintenance - 1).max(0);
    if bunker.data.water_treatment.malfunction {
        for mut inhabitant in workers {
            let level = inhabitants::get_inhabitant_skill_level(inhabitant, SkillType::Repair);
            if skill_roll(0.1, level) {
                bunker.data.water_treatment.malfunction = false;
                let improvement = rand::thread_rng().gen_range(1..5) + level;
                bunker.data.water_treatment.maintenance =
                    (bunker.data.water_treatment.maintenance + improvement).min(100);
                inhabitants::add_xp_to_skill(&mut inhabitant, SkillType::Repair, improvement * 10);
                inhabitant.changed = true;
            }
        }
        if !bunker.data.water_treatment.malfunction {
            messages::create_system_message(
                pool,
                &messages::NewSystemMessage {
                    receiver_bunker_id: bunker.id,
                    sender_name: format!("Water treatment team"),
                    subject: format!("Water treatment report"),
                    body: format!(
                        "The water treatment malfunction has been fixed. Water quality is back to normal."
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
                bunker.data.water_treatment.maintenance =
                    (bunker.data.water_treatment.maintenance + improvement).min(100);
                inhabitants::add_xp_to_skill(&mut inhabitant, SkillType::Repair, improvement * 10);
                inhabitant.changed = true;
            }
        }
        if roll_dice(0.01, 101 - bunker.data.water_treatment.maintenance * power_level / 100) {
            bunker.data.water_treatment.malfunction = true;
            messages::create_system_message(
                pool,
                &messages::NewSystemMessage {
                    receiver_bunker_id: bunker.id,
                    sender_name: format!("Water treatment warning system"),
                    subject: format!("Water treatment malfunction"),
                    body: format!(
                        "A malfunction has been detected in the water treatment system. Water quality is reduced."
                    ),
                },
            )
            .await?;
        }
    }
    let mut water_quality = 100;
    if bunker.data.water_treatment.malfunction {
        water_quality /= 2;
    }
    Ok(water_quality)
}

