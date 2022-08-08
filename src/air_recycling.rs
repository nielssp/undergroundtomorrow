use rand::Rng;
use sqlx::PgPool;

use crate::{
    db::{
        bunkers::Bunker,
        inhabitants::{self, Assignment, Inhabitant, SkillType},
        messages,
    },
    error,
    util::{roll_dice, skill_roll},
};

pub async fn handle_tick(
    pool: &PgPool,
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
    power_level: i32,
) -> Result<i32, error::Error> {
    let workers: Vec<_> = inhabitants
        .iter_mut()
        .filter(|i| i.is_ready() && i.data.assignment == Some(Assignment::AirRecycling))
        .collect();
    let status = &mut bunker.data.air_recycling;
    status.maintenance = (status.maintenance - 1).max(0);
    let existing_malfunction = status.malfunction;
    if !status.malfunction && roll_dice(0.01, 100 - status.maintenance * power_level / 100) {
        status.malfunction = true;
    }
    for mut inhabitant in workers {
        if !status.malfunction && status.maintenance >= 100 {
            break;
        }
        let level = inhabitants::get_inhabitant_skill_level(inhabitant, SkillType::Repair);
        if skill_roll(0.1, level) {
            status.malfunction = false;
            let improvement =
                (rand::thread_rng().gen_range(1..3) + level).min(100 - status.maintenance);
            status.maintenance += improvement;
            inhabitants::add_xp_to_skill(&mut inhabitant, SkillType::Repair, improvement * 10);
            inhabitant.changed = true;
        }
    }
    if existing_malfunction && !status.malfunction {
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
    } else if !existing_malfunction && status.malfunction {
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
    let mut air_quality = 100;
    if bunker.data.air_recycling.malfunction {
        air_quality /= 2;
    }
    Ok(air_quality)
}
