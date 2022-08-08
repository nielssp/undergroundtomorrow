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
        .filter(|i| {
            i.expedition_id.is_none() && i.data.assignment == Some(Assignment::WaterTreatment)
        })
        .collect();
    let status = &mut bunker.data.water_treatment;
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
                sender_name: format!("Water treatment team"),
                subject: format!("Water treatment report"),
                body: format!(
                    "The water treatment malfunction has been fixed. Water quality is back to normal."
                ),
            },
        )
            .await?;
    } else if !existing_malfunction && status.malfunction {
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
    let mut water_quality = 100;
    if status.malfunction {
        water_quality /= 2;
    }
    Ok(water_quality)
}
