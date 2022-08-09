use sqlx::PgPool;

use crate::{
    data::ITEM_TYPES,
    db::{
        bunkers::{self, Bunker, WorkshopProject},
        inhabitants::{Assignment, Inhabitant, SkillType},
        items, messages,
    },
    error,
    util::skill_roll,
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

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPrioritizationRequest {
    index: usize,
}

pub async fn handle_tick(
    pool: &PgPool,
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
) -> Result<(), error::Error> {
    let mut workers: Vec<_> = inhabitants
        .iter_mut()
        .filter(|i| i.is_ready() && i.data.assignment == Some(Assignment::Workshop))
        .collect();
    let projects = &mut bunker.data.workshop.projects;
    let mut common_xp = 0;
    for worker in &mut workers {
        let crafting_level = worker.get_skill_level(SkillType::Crafting);
        for project in projects.iter_mut() {
            if project.progress >= project.max {
                continue;
            }
            let item_type = ITEM_TYPES
                .get(&project.item_type)
                .ok_or_else(|| error::internal_error("Crafting recipe not found"))?;
            let recipe = item_type
                .recipe
                .as_ref()
                .ok_or_else(|| error::internal_error("Invalid crafting recipe"))?;
            if recipe.min_level > crafting_level {
                continue;
            }
            if skill_roll(0.5, crafting_level - recipe.min_level) {
                project.progress += 1;
                worker.add_xp(SkillType::Crafting, 30);
                common_xp += 10;
                let produced = project.progress / (project.max / project.quantity);
                if produced > project.produced {
                    items::add_item(pool, bunker.id, &item_type.id, produced - project.produced)
                        .await?;
                    project.produced = produced;
                    if project.progress >= project.max {
                        messages::create_system_message(
                            pool,
                            &messages::NewSystemMessage {
                                receiver_bunker_id: bunker.id,
                                sender_name: format!("Workshop team"),
                                subject: format!("Project finished: {}", item_type.name),
                                body: if project.produced == 1 {
                                    format!(
                                        "A {} has been constructed in the workshop.",
                                        item_type.name
                                    )
                                } else {
                                    format!(
                                        "{} {} have been constructed in the workshop.",
                                        project.produced, item_type.name_plural
                                    )
                                },
                            },
                        )
                        .await?;
                    }
                }
            }
            break;
        }
    }
    projects.retain(|project| project.progress < project.max);
    if common_xp > 0 {
        for worker in &mut workers {
            worker.add_xp(SkillType::Crafting, common_xp);
        }
    }
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

pub async fn prioritize_project(
    pool: &PgPool,
    bunker: &mut Bunker,
    request: &ProjectPrioritizationRequest,
) -> Result<(), error::Error> {
    if request.index < 1 || request.index >= bunker.data.workshop.projects.len() {
        Err(error::client_error("OUT_OF_RANGE"))?;
    }
    bunker.data.workshop.projects.swap(0, request.index);
    bunkers::update_bunker_data_query(bunker)
        .execute(pool)
        .await?;
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
