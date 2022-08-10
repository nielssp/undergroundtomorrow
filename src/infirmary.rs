use std::collections::HashMap;

use sqlx::PgPool;

use crate::{
    db::{
        bunkers::{self, Bunker},
        inhabitants::{Assignment, Inhabitant, SkillType},
        items,
    },
    error,
    util::{skill_roll, roll_dice},
};

enum Action {
    StopBleeding,
    TreatWound,
    StopInfection,
    TreatDisease,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInventoryRequest {
    medicine: i32,
}

pub fn handle_tick(
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
) -> Result<(), error::Error> {
    let mut actions: Vec<(i32, i32, Action)> = vec![];
    for doctor in inhabitants.iter() {
        if doctor.data.assignment != Some(Assignment::Infirmary) || !doctor.is_ready() {
            continue;
        }
        let mut max_actions = 4;
        for inhabitant in inhabitants.iter() {
            if !inhabitant.needs_attention() || inhabitant.expedition_id.is_some() {
                continue;
            }
            let first_aid_level = doctor.get_skill_level(SkillType::FirstAid);
            let medicine_level = doctor.get_skill_level(SkillType::Medicine);
            // TODO: get medicine from storage
            if inhabitant.data.bleeding {
                max_actions -= 1;
                if skill_roll(0.4, first_aid_level + medicine_level) {
                    actions.push((inhabitant.id, doctor.id, Action::StopBleeding));
                }
            }
            if inhabitant.data.wounded {
                max_actions -= 1;
                let chance = if bunker.data.infirmary.medicine > 0 {
                    if roll_dice(0.1, 1) {
                        bunker.data.infirmary.medicine -= 1;
                    }
                    0.1
                } else {
                    0.01
                };
                if skill_roll(chance, first_aid_level + medicine_level) {
                    actions.push((inhabitant.id, doctor.id, Action::TreatWound));
                }
            }
            if inhabitant.data.infection {
                max_actions -= 1;
                let chance = if bunker.data.infirmary.medicine > 0 {
                    if roll_dice(0.1, 1) {
                        bunker.data.infirmary.medicine -= 1;
                    }
                    0.05
                } else {
                    0.001
                };
                if skill_roll(chance, first_aid_level + medicine_level) {
                    actions.push((inhabitant.id, doctor.id, Action::StopInfection));
                }
            }
            if inhabitant.data.sick {
                max_actions -= 1;
                let chance = if bunker.data.infirmary.medicine > 0 {
                    if roll_dice(0.1, 1) {
                        bunker.data.infirmary.medicine -= 1;
                    }
                    0.05
                } else {
                    0.001
                };
                if skill_roll(chance, first_aid_level + medicine_level) {
                    actions.push((inhabitant.id, doctor.id, Action::TreatDisease));
                }
            }
            if max_actions <= 0 {
                break;
            }
        }
    }
    for inhabitant in inhabitants {
        for (patient_id, doctor_id, action) in &actions {
            if *patient_id == inhabitant.id {
                match action {
                    Action::StopBleeding => inhabitant.data.bleeding = false,
                    Action::TreatWound => inhabitant.data.wounded = false,
                    Action::StopInfection => inhabitant.data.infection = false,
                    Action::TreatDisease => inhabitant.data.sick = false,
                }
                inhabitant.data.recovering = !inhabitant.needs_attention();
                inhabitant.changed = true;
            } else if *doctor_id == inhabitant.id {
                inhabitant.add_xp(SkillType::Medicine, 30);
                inhabitant.changed = true;
            }
        }
    }
    Ok(())
}

impl Inhabitant {
    fn needs_attention(&self) -> bool {
        self.data.bleeding || self.data.wounded || self.data.infection || self.data.sick
    }
}

pub async fn update_inventory(
    pool: &PgPool,
    bunker: &mut Bunker,
    request: &UpdateInventoryRequest,
) -> Result<(), error::Error> {
    let mut tx = pool.begin().await?;
    let existing = bunker.data.infirmary.medicine;
    if existing < request.medicine {
        let diff = request.medicine - existing;
        let affected = items::remove_items_query(bunker.id, "medicine", diff)
            .execute(&mut tx)
            .await?
            .rows_affected();
        if affected < 1 {
            Err(error::client_error("MISSING_ITEM"))?;
        }
    } else if existing > request.medicine {
        let diff = existing - request.medicine;
        items::add_item_query(bunker.id, "medicine", diff)
            .execute(&mut tx)
            .await?;
    } else {
        return Ok(());
    }
    // TODO: SELECT .. FOR UPDATE to lock row
    bunker.data.infirmary.medicine = request.medicine;
    bunkers::update_bunker_data_query(bunker)
        .execute(&mut tx)
        .await?;
    tx.commit().await?;
    items::remove_empty_items(pool, bunker.id).await?;
    Ok(())
}
