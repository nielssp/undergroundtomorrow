use rand::Rng;
use sqlx::PgPool;

use crate::{
    data::ITEM_TYPES,
    db::{
        bunkers::{self, Bunker},
        inhabitants::{self, Assignment, Inhabitant, SkillType},
        items, messages,
    },
    error,
    util::{roll_dice, skill_roll},
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefuelingRequest {
    item_type: String,
}

pub async fn handle_tick(
    pool: &PgPool,
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
) -> Result<i32, error::Error> {
    let workers: Vec<_> = inhabitants
        .iter_mut()
        .filter(|i| i.is_ready() && i.data.assignment == Some(Assignment::Reactor))
        .collect();
    let status = &mut bunker.data.reactor;
    if status.fuel == 1 {
        messages::create_system_message(
            pool,
            &messages::NewSystemMessage {
                receiver_bunker_id: bunker.id,
                sender_name: format!("Reactor warning system"),
                subject: format!("Reactor fuel warning"),
                body: format!("The reactor fuel rod needs to be replaced as soon as possible. Power output is reduced."),
            },
        ).await?;
    }
    status.fuel = (status.fuel - 1).max(0);
    status.maintenance = (status.maintenance - 1).max(0);
    let existing_malfunction = status.malfunction;
    if !status.malfunction && roll_dice(0.01, 100 - status.maintenance) {
        status.malfunction = true;
    }
    for mut inhabitant in workers {
        if !status.malfunction && status.maintenance >= 100 {
            break;
        }
        let level = inhabitants::get_inhabitant_skill_level(inhabitant, SkillType::Reactor);
        if skill_roll(0.1, level) {
            status.malfunction = false;
            let improvement =
                (rand::thread_rng().gen_range(1..3) + level).min(100 - status.maintenance);
            status.maintenance += improvement;
            inhabitants::add_xp_to_skill(&mut inhabitant, SkillType::Reactor, improvement * 10);
            inhabitant.changed = true;
        }
    }
    if existing_malfunction && !status.malfunction {
        messages::create_system_message(
            pool,
            &messages::NewSystemMessage {
                receiver_bunker_id: bunker.id,
                sender_name: format!("Reactor team"),
                subject: format!("Reactor report"),
                body: format!(
                    "The reactor malfunction has been fixed. Power output is back to normal."
                ),
            },
        )
        .await?;
    } else if !existing_malfunction && status.malfunction {
        messages::create_system_message(
            pool,
            &messages::NewSystemMessage {
                receiver_bunker_id: bunker.id,
                sender_name: format!("Reactor warning system"),
                subject: format!("Reactor malfunction"),
                body: format!(
                    "A malfunction has been detected in the reactor. Power output is reduced."
                ),
            },
        )
        .await?;
    }
    let mut power_level = 100;
    if status.fuel < 1 {
        power_level /= 2;
    }
    if status.malfunction {
        power_level /= 2;
    }
    Ok(power_level)
}

pub async fn refuel(
    pool: &PgPool,
    bunker: &mut Bunker,
    refueling_request: &RefuelingRequest,
) -> Result<(), error::Error> {
    let mut tx = pool.begin().await?;
    let item_type = ITEM_TYPES
        .get(&refueling_request.item_type)
        .ok_or_else(|| error::client_error("UNKNOWN_ITEM_TYPE"))?;
    if item_type.reactivity < 1 {
        Err(error::client_error("INVALID_FUEL_TYPE"))?;
    }
    let affected = items::remove_items_query(bunker.id, &item_type.id, 1)
        .execute(&mut tx)
        .await?
        .rows_affected();
    if affected < 1 {
        Err(error::client_error("MISSING_ITEM"))?;
    }
    let fuel_rod = if bunker.data.reactor.fuel >= 10000 {
        "fuel-rod"
    } else if bunker.data.reactor.fuel >= 9000 {
        "fuel-rod-90"
    } else if bunker.data.reactor.fuel >= 8000 {
        "fuel-rod-80"
    } else if bunker.data.reactor.fuel >= 7000 {
        "fuel-rod-70"
    } else if bunker.data.reactor.fuel >= 6000 {
        "fuel-rod-60"
    } else if bunker.data.reactor.fuel >= 5000 {
        "fuel-rod-50"
    } else if bunker.data.reactor.fuel >= 4000 {
        "fuel-rod-40"
    } else if bunker.data.reactor.fuel >= 3000 {
        "fuel-rod-30"
    } else if bunker.data.reactor.fuel >= 2000 {
        "fuel-rod-20"
    } else if bunker.data.reactor.fuel >= 1000 {
        "fuel-rod-10"
    } else {
        "depleted-fuel-rod"
    };
    items::add_item_query(bunker.id, fuel_rod, 1)
        .execute(&mut tx)
        .await?;
    // TODO: SELECT .. FOR UPDATE to lock row
    bunker.data.reactor.fuel = item_type.reactivity;
    bunkers::update_bunker_data_query(bunker)
        .execute(&mut tx)
        .await?;
    tx.commit().await?;
    Ok(())
}
