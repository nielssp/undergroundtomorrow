use log::info;
use sqlx::postgres::PgRow;
use sqlx::{PgPool, Row};

use crate::error;

#[derive(serde::Serialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub admin: bool,
}

pub struct Password {
    pub user_id: i64,
    pub password: String,
}

#[derive(serde::Deserialize)]
pub struct NewUser {
    pub username: String,
    pub password: String,
}

fn map_user(row: PgRow) -> Result<User, sqlx::Error> {
    Ok(User {
        id: row.try_get("id")?,
        username: row.try_get("username")?,
        admin: row.try_get("admin")?,
    })
}

pub async fn get_password_by_username(
    pool: &PgPool,
    username: &str,
) -> Result<Option<Password>, error::Error> {
    let result = sqlx::query("SELECT id, password FROM users WHERE username = $1")
        .bind(username)
        .fetch_optional(pool)
        .await?;
    if let Some(row) = result {
        Ok(Some(Password {
            user_id: row.try_get(0)?,
            password: row.try_get(1)?,
        }))
    } else {
        Ok(None)
    }
}

pub async fn get_password_by_user_id(
    pool: &PgPool,
    user_id: i64,
) -> Result<Option<Password>, error::Error> {
    let result = sqlx::query("SELECT id, password FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    if let Some(row) = result {
        Ok(Some(Password {
            user_id: row.try_get(0)?,
            password: row.try_get(1)?,
        }))
    } else {
        Ok(None)
    }
}

pub async fn get_user_by_id(pool: &PgPool, user_id: i64) -> Result<Option<User>, error::Error> {
    Ok(
        sqlx::query("SELECT id, username, admin FROM users WHERE id = $1")
            .bind(user_id)
            .try_map(map_user)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn create_user(pool: &PgPool, new_user: NewUser) -> Result<User, error::Error> {
    let id = sqlx::query("INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id")
        .bind(&new_user.username)
        .bind(&new_user.password)
        .fetch_one(pool)
        .await
        .map_err(|err| match err.as_database_error() {
            Some(database_error) => {
                if database_error.constraint() == Some("users_username_key") {
                    info!("Username taken: {}", new_user.username);
                    error::Error::UsernameTaken
                } else {
                    error::Error::SqlxError(err)
                }
            }
            _ => error::Error::SqlxError(err),
        })?
        .try_get(0)?;
    Ok(User {
        id,
        username: new_user.username,
        admin: false,
    })
}

pub async fn change_password(
    pool: &PgPool,
    user_id: i64,
    password: &str,
) -> Result<(), error::Error> {
    sqlx::query("UPDATE users SET password = $1 WHERE id = $2")
        .bind(&password)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}
