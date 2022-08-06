use itertools::Itertools;
use sqlx::{PgPool, query::Query, Postgres, postgres::PgArguments};

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
    item_type: &str,
    quantity: i32,
) -> Result<(), error::Error> {
    sqlx::query(
        "INSERT INTO items (bunker_id, item_type, quantity) VALUES ($1, $2, $3) \
        ON CONFLICT (bunker_id, item_type) \
        DO UPDATE SET quantity = items.quantity + EXCLUDED.quantity",
    )
    .bind(bunker_id)
    .bind(item_type)
    .bind(quantity)
    .execute(pool)
    .await?;
    Ok(())
}

pub fn remove_items_query(
    bunker_id: i32,
    item_type: &str,
    quantity: i32,
) -> Query<Postgres, PgArguments> {
    sqlx::query(
        "UPDATE items SET quantity = quantity - $3 WHERE bunker_id = $1 AND item_type = $2 AND quantity >= $3",
    )
        .bind(bunker_id)
        .bind(item_type)
        .bind(quantity)
}

pub async fn remove_item(
    pool: &PgPool,
    bunker_id: i32,
    item_type: &str,
    quantity: i32,
) -> Result<bool, error::Error> {
    Ok(remove_items_query(bunker_id, item_type, quantity)
    .execute(pool)
    .await?
    .rows_affected() > 0)
}

pub async fn remove_empty_items(
    pool: &PgPool,
    bunker_id: i32,
) -> Result<(), error::Error> {
    sqlx::query("DELETE FROM items WHERE bunker_id = $1 AND quantity <= 0")
        .bind(bunker_id)
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

pub async fn get_items_by_id(
    pool: &PgPool,
    bunker_id: i32,
    item_types: Vec<String>,
) -> Result<Vec<Item>, error::Error> {
    if item_types.is_empty() {
        return Ok(vec![]);
    }
    let params = (0..item_types.len())
        .map(|i| format!("${}", i + 2))
        .join(", ");
    let query_str = format!(
        "SELECT * FROM items i \
        WHERE i.bunker_id = $1 AND i.item_type IN ( { } )",
        params
    );

    let mut query = sqlx::query_as(&query_str).bind(bunker_id);
    for item_type in item_types {
        query = query.bind(item_type);
    }
    Ok(query
        .fetch_all(pool)
        .await?)
}
