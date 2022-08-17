use sqlx::PgPool;
use tracing::warn;

use crate::{
    data::ITEM_TYPES,
    db::{
        bunkers::{self, Bunker, Crop},
        inhabitants::{Assignment, Inhabitant, SkillType},
        items,
    },
    error,
    util::{roll_dice, skill_roll},
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCropRequest {
    seed_type: String,
    amount: i32,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropRemovalRequest {
    index: usize,
}

pub async fn handle_tick(
    pool: &PgPool,
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
    power_level: i32,
    water_quality: i32,
) -> Result<(), error::Error> {
    let mut workers: Vec<_> = inhabitants
        .iter_mut()
        .filter(|i| i.is_ready() && i.data.assignment == Some(Assignment::Horticulture))
        .collect();
    let mut harvestable = workers.len() * 2;
    for crop in &mut bunker.data.horticulture.crops {
        let crop_type = ITEM_TYPES
            .get(&crop.seed_type)
            .ok_or_else(|| error::internal_error("Unknown crop type"))?;
        if roll_dice(1.0 / 24.0, 1) {
            if crop.stunted {
                crop.stage -= 1;
            } else {
                crop.stage += 1;
            }
        }
        if crop.stage > crop_type.growth_time {
            crop.stage = crop_type.growth_time;
        }
        if !crop.stunted {
            if roll_dice(0.005, 1 + 20 - power_level * water_quality / 500) {
                crop.stunted = true;
            }
        }
        if crop.stunted {
            for worker in &mut workers {
                if worker.data.sleeping {
                    continue;
                }
                let level = worker.get_skill_level(SkillType::Botany);
                if skill_roll(0.05, level) {
                    crop.stunted = false;
                    worker.add_xp(SkillType::Botany, 40);
                    worker.changed = true;
                    break;
                }
            }
        }
        if crop.stage >= crop_type.growth_time * 8 / 10 {
            let chance = crop.quantity as f64 / crop_type.growth_time as f64 / 24.0;
            if roll_dice(chance, 1) {
                if let Some(produce) = &crop_type.produce {
                    if harvestable > 0 {
                        harvestable -= 1;
                        items::add_item(pool, bunker.id, produce, 1).await?;
                    }
                }
            }
        }
    }
    bunker
        .data
        .horticulture
        .crops
        .retain(|crop| crop.stage >= 0);
    Ok(())
}

pub async fn remove_crop(
    pool: &PgPool,
    bunker: &mut Bunker,
    request: &CropRemovalRequest,
) -> Result<(), error::Error> {
    if request.index >= bunker.data.horticulture.crops.len() {
        Err(error::client_error("OUT_OF_RANGE"))?;
    }
    bunker.data.horticulture.crops.remove(request.index);
    bunkers::update_bunker_data_query(bunker)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn add_crop(
    pool: &PgPool,
    bunker: &mut Bunker,
    request: &NewCropRequest,
) -> Result<(), error::Error> {
    if bunker.data.horticulture.crops.len() >= 6 {
        Err(error::client_error("TOO_MANY_CROPS"))?;
    }
    if request.amount < 1 {
        Err(error::client_error("INVALID_AMOUNT"))?;
    }
    let seed_type = ITEM_TYPES
        .get(&request.seed_type)
        .filter(|s| s.seed)
        .ok_or_else(|| error::client_error("INVALID_SEED_TYPE"))?;
    let mut tx = pool.begin().await?;
    let affected = items::remove_items_query(bunker.id, &seed_type.id, request.amount)
        .execute(&mut tx)
        .await?
        .rows_affected();
    if affected < 1 {
        Err(error::client_error("MISSING_ITEM"))?;
    }
    // TODO: SELECT .. FOR UPDATE to lock row
    bunker.data.horticulture.crops.push(Crop {
        seed_type: seed_type.id.clone(),
        name: seed_type.name_plural.clone(),
        quantity: request.amount,
        stage: 1,
        max: seed_type.growth_time,
        stunted: false,
        diseased: false,
    });
    bunkers::update_bunker_data_query(bunker)
        .execute(&mut tx)
        .await?;
    tx.commit().await?;
    items::remove_empty_items(pool, bunker.id).await?;
    Ok(())
}
