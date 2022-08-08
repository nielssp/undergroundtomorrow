use crate::{
    db::{
        bunkers::Bunker,
        inhabitants::{Assignment, Inhabitant, SkillType},
    },
    error,
    util::skill_roll,
};

enum Action {
    StopBleeding,
    TreatWound,
    StopInfection,
    TreatDisease,
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
            if !inhabitant.needs_attention() {
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
                if skill_roll(0.1, first_aid_level + medicine_level) {
                    actions.push((inhabitant.id, doctor.id, Action::TreatWound));
                }
            }
            if inhabitant.data.infection {
                max_actions -= 1;
                if skill_roll(0.01, first_aid_level + medicine_level) {
                    actions.push((inhabitant.id, doctor.id, Action::StopInfection));
                }
            }
            if inhabitant.data.sick {
                max_actions -= 1;
                if skill_roll(0.1, first_aid_level + medicine_level) {
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
