/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};

use crate::error;

#[derive(serde::Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: i32,
    pub receiver_bunker_id: i32,
    pub sender_bunker_id: Option<i32>,
    pub sender_name: String,
    pub subject: String,
    pub body: String,
    pub created: DateTime<Utc>,
    pub unread: bool,
}

pub struct NewSystemMessage {
    pub receiver_bunker_id: i32,
    pub sender_name: String,
    pub subject: String,
    pub body: String,
}

pub async fn get_messages(
    pool: &PgPool,
    bunker_id: i32,
    older_than: Option<DateTime<Utc>>,
) -> Result<Vec<Message>, error::Error> {
    if let Some(older_than) = older_than {
        Ok(sqlx::query_as("SELECT * FROM messages WHERE receiver_bunker_id = $1 AND created < $2 ORDER BY created DESC LIMIT 50")
            .bind(bunker_id)
            .bind(older_than)
            .fetch_all(pool)
            .await?)
    } else {
        Ok(sqlx::query_as(
            "SELECT * FROM messages WHERE receiver_bunker_id = $1 ORDER BY created DESC LIMIT 50",
        )
        .bind(bunker_id)
        .fetch_all(pool)
        .await?)
    }
}

pub async fn create_system_message(
    pool: &PgPool,
    message: &NewSystemMessage,
) -> Result<(), error::Error> {
    sqlx::query(
        "INSERT INTO messages (receiver_bunker_id, sender_name, subject, body, created) \
        VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(message.receiver_bunker_id)
    .bind(&message.sender_name)
    .bind(&message.subject)
    .bind(&message.body)
    .bind(Utc::now())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_message_read(
    pool: &PgPool,
    bunker_id: i32,
    message_id: i32,
) -> Result<(), error::Error> {
    sqlx::query("UPDATE messages SET unread = false WHERE receiver_bunker_id = $1 AND id = $2")
        .bind(bunker_id)
        .bind(message_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_all_messages_read(pool: &PgPool, bunker_id: i32) -> Result<(), error::Error> {
    sqlx::query("UPDATE messages SET unread = false WHERE receiver_bunker_id = $1")
        .bind(bunker_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn unread_messages_exist(
    pool: &PgPool,
    bunker_id: i32,
) -> Result<Option<DateTime<Utc>>, error::Error> {
    Ok(sqlx::query(
        "SELECT created FROM messages WHERE receiver_bunker_id = $1 AND unread = true ORDER BY created DESC LIMIT 1",
    )
    .bind(bunker_id)
    .try_map(|row| row.try_get("created"))
    .fetch_optional(pool)
    .await?
    )
}
