use chrono::{DateTime, Utc};
use sqlx::PgPool;

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
