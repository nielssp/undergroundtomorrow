use sqlx::PgPool;

use crate::error;

#[derive(sqlx::FromRow, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: i32,
    pub bunker_id: i32,
    pub item_type: String,
    pub quantity: i32,
}

pub async fn add_item(
    pool: &PgPool,
    bunker_id: i32,
    item_type: String,
    quantity: i32,
) -> Result<(), error::Error> {
    sqlx::query(
        "INSERT INTO items (bunker_id, item_type, quantity) VALUES ($1, $2, $3) \
        ON CONFLICT (bunker_id, item_type) \
        DO UPDATE SET quantity = quantity + EXCLUDED.quantity",
    )
    .bind(bunker_id)
    .bind(item_type)
    .bind(quantity)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_items(pool: &PgPool, bunker_id: i32) -> Result<Vec<Item>, error::Error> {
    Ok(
        sqlx::query_as("SELECT * FROM items WHERE bunker_id = $1 ORDER BY item_type ASC")
            .bind(bunker_id)
            .fetch_all(pool)
            .await?,
    )
}
