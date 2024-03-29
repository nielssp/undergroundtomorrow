/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};

use crate::error;

use super::users::User;

pub struct Session {
    pub id: String,
    pub valid_until: DateTime<Utc>,
    pub user: User,
}

pub async fn get_session(pool: &PgPool, session_id: &str) -> Result<Option<Session>, error::Error> {
    let result = sqlx::query(
        "SELECT s.id AS session_id, s.valid_until, u.id AS user_id, u.username, u.admin, u.guest \
        FROM sessions s INNER JOIN users u ON s.user_id = u.id WHERE s.id = $1",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?;
    if let Some(row) = result {
        Ok(Some(Session {
            id: row.try_get("session_id")?,
            valid_until: row.try_get("valid_until")?,
            user: User {
                id: row.try_get("user_id")?,
                username: row.try_get("username")?,
                admin: row.try_get("admin")?,
                guest: row.try_get("guest")?,
            },
        }))
    } else {
        Ok(None)
    }
}

pub async fn create_session(
    pool: &PgPool,
    session_id: &str,
    valid_until: DateTime<Utc>,
    user_id: i64,
) -> Result<(), error::Error> {
    sqlx::query("INSERT INTO sessions (id, valid_until, user_id) VALUES ($1, $2, $3)")
        .bind(session_id)
        .bind(valid_until.naive_utc())
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_session(pool: &PgPool, session_id: &str) -> Result<(), error::Error> {
    sqlx::query("DELETE FROM sessions WHERE id = $1")
        .bind(session_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_expired_sessions(pool: &PgPool) -> Result<u64, error::Error> {
    let deleted = sqlx::query("DELETE FROM sessions WHERE valid_until < CURRENT_TIMESTAMP")
        .execute(pool)
        .await?
        .rows_affected();
    Ok(deleted)
}
