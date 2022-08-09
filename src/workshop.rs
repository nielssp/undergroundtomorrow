use sqlx::PgPool;

use crate::{
    data::ITEM_TYPES,
    db::{
        bunkers::{self, Bunker, WorkshopProject},
        inhabitants::Inhabitant,
        items,
    },
    error,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewProjectRequest {
    item_type: String,
    quantity: i32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRemovalRequest {
    index: usize,
}

pub fn handle_tick(
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
) -> Result<(), error::Error> {
    Ok(())
}

pub async fn remove_project(
    pool: &PgPool,
    bunker: &mut Bunker,
    request: &ProjectRemovalRequest,
) -> Result<(), error::Error> {
    if request.index >= bunker.data.workshop.projects.len() {
        Err(error::client_error("OUT_OF_RANGE"))?;
    }
    let mut tx = pool.begin().await?;
    let project = &bunker.data.workshop.projects[request.index];
    if let Some(recipe) = ITEM_TYPES
        .get(&project.item_type)
        .map(|i| i.recipe.as_ref())
        .flatten()
    {
        for (ingredient_type, quantity) in &recipe.ingredients {
            let affected =
                items::add_item_query(bunker.id, ingredient_type, project.quantity * quantity)
                    .execute(&mut tx)
                    .await?;
        }
    }
    bunker.data.workshop.projects.remove(request.index);
    bunkers::update_bunker_data_query(bunker)
        .execute(&mut tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn add_project(
    pool: &PgPool,
    bunker: &mut Bunker,
    request: &NewProjectRequest,
) -> Result<(), error::Error> {
    if bunker.data.workshop.projects.len() >= 20 {
        Err(error::client_error("TOO_MANY_PROJECTS"))?;
    }
    if request.quantity < 1 {
        Err(error::client_error("INVALID_QUANTITY"))?;
    }
    let item_type = ITEM_TYPES
        .get(&request.item_type)
        .ok_or_else(|| error::client_error("INVALID_ITEM_TYPE"))?;
    let recipe = item_type
        .recipe
        .as_ref()
        .ok_or_else(|| error::client_error("INVALID_RECIPE"))?;
    let mut tx = pool.begin().await?;
    for (ingredient_type, quantity) in &recipe.ingredients {
        let affected =
            items::remove_items_query(bunker.id, ingredient_type, request.quantity * quantity)
                .execute(&mut tx)
                .await?
                .rows_affected();
        if affected < 1 {
            Err(error::client_error("MISSING_ITEM"))?;
        }
    }
    // TODO: SELECT .. FOR UPDATE to lock row
    bunker.data.workshop.projects.push(WorkshopProject {
        item_type: item_type.id.clone(),
        quantity: request.quantity,
        progress: 0,
        max: recipe.time * request.quantity,
        produced: 0,
    });
    bunkers::update_bunker_data_query(bunker)
        .execute(&mut tx)
        .await?;
    tx.commit().await?;
    items::remove_empty_items(pool, bunker.id).await?;
    Ok(())
}
