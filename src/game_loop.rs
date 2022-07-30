use rand::Rng;
use sqlx::PgPool;

use crate::{
    data::LOCATION_TYPES,
    db::{expeditions, items, locations, messages},
    error,
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
        let mut report_body = "".to_string();
        if let Some(location_id) = expedition.location_id {
            let location = locations::get_location(pool, location_id).await?;
            report_body.push_str(&format!("Successfully explored {}\n", location.name));
            let location_type = LOCATION_TYPES
                .get(&location.data.location_type)
                .ok_or_else(|| error::internal_error("Unknown location type"))?;
            // TODO: team members
            for (item_type, entry) in &location_type.loot {
                if rand::random::<f64>() <= entry.chance {
                    let quantity = rand::thread_rng().gen_range(entry.min..entry.max + 1);
                    report_body.push_str(&format!("Found {} {}\n", quantity, item_type));
                    items::add_item(pool, expedition.bunker_id, item_type, quantity).await?;
                }
            }
        } else {
            // TODO: discover locations
        }
        messages::create_system_message(
            pool,
            &messages::NewSystemMessage {
                receiver_bunker_id: expedition.bunker_id,
                sender_name: format!("Expedition team"),
                subject: format!("Expedition report"),
                body: report_body,
            },
        )
        .await?;
        expeditions::delete_expedition(pool, expedition.id).await?;
    }
    Ok(())
}
