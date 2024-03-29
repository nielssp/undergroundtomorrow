/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use chrono::{DateTime, Utc};
use sqlx::{types::Json, PgPool, Row};

use crate::error;

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpeditionData {
    #[serde(default)]
    pub distance: i32,
}

#[derive(serde::Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Expedition {
    pub id: i32,
    pub bunker_id: i32,
    pub location_id: Option<i32>,
    pub zone_x: i32,
    pub zone_y: i32,
    pub eta: DateTime<Utc>,
    pub data: Json<ExpeditionData>,
    pub created: DateTime<Utc>,
}

pub struct NewExpedition {
    pub bunker_id: i32,
    pub location_id: Option<i32>,
    pub zone_x: i32,
    pub zone_y: i32,
    pub eta: DateTime<Utc>,
    pub data: ExpeditionData,
}

pub async fn create_expedition(
    pool: &PgPool,
    expedition: &NewExpedition,
) -> Result<i32, error::Error> {
    Ok(sqlx::query(
        "INSERT INTO expeditions (bunker_id, location_id, zone_x, zone_y, eta, data, created) \
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(expedition.bunker_id)
    .bind(expedition.location_id)
    .bind(expedition.zone_x)
    .bind(expedition.zone_y)
    .bind(expedition.eta)
    .bind(Json(&expedition.data))
    .bind(Utc::now())
    .fetch_one(pool)
    .await?
    .try_get(0)?)
}

pub async fn delete_expedition(pool: &PgPool, expedition_id: i32) -> Result<(), error::Error> {
    sqlx::query("DELETE FROM expeditions WHERE id = $1")
        .bind(expedition_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_expeditions(
    pool: &PgPool,
    bunker_id: i32,
) -> Result<Vec<Expedition>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM expeditions WHERE bunker_id = $1")
            .bind(bunker_id)
            .fetch_all(pool)
            .await?,
    )
}

pub async fn get_finished_expeditions(
    pool: &PgPool,
    world_id: i32,
) -> Result<Vec<Expedition>, error::Error> {
    Ok(sqlx::query_as(
        "SELECT * FROM expeditions WHERE eta <= CURRENT_TIMESTAMP \
            AND bunker_id IN (SELECT id FROM bunkers WHERE world_id = $1)",
    )
    .bind(world_id)
    .fetch_all(pool)
    .await?)
}
