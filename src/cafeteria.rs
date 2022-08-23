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

pub async fn handle_tick(
    pool: &PgPool,
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
    power_level: i32,
) -> Result<(), error::Error> {
    let num_inhabitants = inhabitants.len() as i32;
    let mut workers: Vec<_> = inhabitants
        .iter_mut()
        .filter(|i| {
            i.is_ready() && !i.data.sleeping && i.data.assignment == Some(Assignment::Cafeteria)
        })
        .collect();
    if !workers.is_empty() && bunker.data.cafeteria.food < num_inhabitants * 2 {
        let ingredients = items::get_items(pool, bunker.id).await?;
        let mut food_to_cook = num_inhabitants * 3;
        let mut cooked = false;
        for ingredient in ingredients {
            if let Some(item_type) = ITEM_TYPES.get(&ingredient.item_type) {
                if !item_type.food {
                    continue;
                }
                let quantity = food_to_cook.min(ingredient.quantity);
                if items::remove_item(pool, bunker.id, &item_type.id, quantity).await? {
                    cooked = true;
                    bunker.data.cafeteria.food += quantity;
                    food_to_cook -= quantity;
                    for worker in workers.iter_mut() {
                        worker.add_xp(SkillType::Cooking, quantity);
                    }
                    if food_to_cook <= 0 {
                        break;
                    }
                }
            }
        }
        if cooked {
            items::remove_empty_items(pool, bunker.id).await?;
        }
    }
    Ok(())
}
