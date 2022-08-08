use chrono::{Duration, Utc};
use rand::Rng;
use sqlx::PgPool;

use crate::{
    air_recycling,
    db::{
        bunkers,
        inhabitants::{self, Assignment},
        worlds::{self, WorldTime},
    },
    error, expedition, reactor, water_treatment,
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
    let bunkers = bunkers::get_bunkers_by_next_tick(pool, world.id).await?;
    for mut bunker in bunkers {
        let mut inhabitants = inhabitants::get_inhabitants(pool, bunker.id).await?;

        let power_level = reactor::handle_tick(pool, &mut bunker, &mut inhabitants).await?;
        let water_quality =
            water_treatment::handle_tick(pool, &mut bunker, &mut inhabitants, power_level).await?;
        let air_quality =
            air_recycling::handle_tick(pool, &mut bunker, &mut inhabitants, power_level).await?;

        for inhabitant in inhabitants {
            if inhabitant.changed {
                inhabitants::update_inhabitant_data(pool, &inhabitant).await?;
            }
        }

        let seconds = rand::thread_rng().gen_range(3600..5400) / world.time_acceleration;
        bunker.next_tick = Utc::now() + Duration::seconds(seconds as i64);
        bunkers::update_bunker_data_and_tick(pool, &bunker).await?;
    }
    expedition::handle_finished_expeditions(pool, world).await?;
    Ok(())
}
