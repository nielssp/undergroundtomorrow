/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use std::collections::HashMap;

use actix::Addr;
use chrono::{Duration, Utc};
use rand::Rng;
use sqlx::PgPool;

use crate::{
    air_recycling,
    broadcaster::{Broadcaster, BunkerMessage, Message},
    cafeteria,
    db::{
        bunkers,
        inhabitants::{self, Assignment},
        items, messages,
        worlds::{self, WorldTime},
    },
    error, expedition, health, horticulture, infirmary, reactor, water_treatment, workshop,
};

pub fn start_loop(pool: PgPool, broadcaster: Addr<Broadcaster>) {
    actix_rt::spawn(async move {
        let mut interval = actix_rt::time::interval(std::time::Duration::from_secs(10));
        loop {
            interval.tick().await;
            tick(&pool, &broadcaster).await.unwrap(); // TODO: error handling
        }
    });
}

pub async fn tick(pool: &PgPool, broadcaster: &Addr<Broadcaster>) -> Result<(), error::Error> {
    let worlds = worlds::get_world_times(pool).await?;
    for world in &worlds {
        world_tick(pool, world, broadcaster).await?;
    }
    Ok(())
}

pub async fn world_tick(
    pool: &PgPool,
    world: &WorldTime,
    broadcaster: &Addr<Broadcaster>,
) -> Result<(), error::Error> {
    let bunkers = bunkers::get_bunkers_by_next_tick(pool, world.id).await?;
    for mut bunker in bunkers {
        let mut inhabitants = inhabitants::get_inhabitants(pool, bunker.id).await?;

        let power_level = reactor::handle_tick(pool, &mut bunker, &mut inhabitants).await?;
        let water_quality =
            water_treatment::handle_tick(pool, &mut bunker, &mut inhabitants, power_level).await?;
        let air_quality =
            air_recycling::handle_tick(pool, &mut bunker, &mut inhabitants, power_level).await?;

        horticulture::handle_tick(
            pool,
            &mut bunker,
            &mut inhabitants,
            power_level,
            water_quality,
        )
        .await?;
        cafeteria::handle_tick(pool, &mut bunker, &mut inhabitants, power_level).await?;
        workshop::handle_tick(pool, &mut bunker, &mut inhabitants).await?;
        infirmary::handle_tick(&mut bunker, &mut inhabitants)?;

        health::handle_tick(&mut bunker, &mut inhabitants, water_quality, air_quality)?;

        for inhabitant in inhabitants {
            if inhabitant.data.health <= 0 {
                messages::create_system_message(
                    pool,
                    &messages::NewSystemMessage {
                        receiver_bunker_id: bunker.id,
                        sender_name: format!("Infirmary"),
                        subject: format!("{} has died", inhabitant.name),
                        body: if inhabitant.data.bleeding {
                            format!("{} has died of severe blood loss.", inhabitant.name)
                        } else if inhabitant.data.infection {
                            format!("{} has died of an infection.", inhabitant.name)
                        } else if inhabitant.data.wounded {
                            format!("{} has died of untreated wounds.", inhabitant.name)
                        } else if inhabitant.data.sick {
                            format!("{} has died of surface sickness.", inhabitant.name)
                        } else {
                            format!("{} has died of an unknown cause.", inhabitant.name)
                        },
                    },
                )
                .await?;
                inhabitants::delete_inhabitant(pool, inhabitant.id).await?;
            } else {
                inhabitants::update_inhabitant_data(pool, &inhabitant).await?;
            }
        }

        let seconds = rand::thread_rng().gen_range(2400..4800) / world.time_acceleration;
        bunker.next_tick = Utc::now() + Duration::seconds(seconds as i64);
        bunkers::update_bunker_data_and_tick(pool, &bunker).await?;

        broadcaster.do_send(BunkerMessage {
            bunker_id: bunker.id,
            message: Message::Tick,
        });
    }
    expedition::handle_finished_expeditions(pool, world, broadcaster).await?;
    Ok(())
}
