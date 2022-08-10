use chrono::{Duration, NaiveDate, NaiveDateTime};
use rand::{seq::IteratorRandom, Rng};

use crate::{
    data::{FIRST_NAMES, LAST_NAMES},
    db::inhabitants::{get_xp_for_level, InhabitantData, NewInhabitant, Skill, SKILL_TYPES},
};

pub fn generate_person(
    world_time: NaiveDateTime,
    min_age: i32,
    max_age: i32,
    last_names: &Vec<&String>,
) -> NewInhabitant {
    let mut rng = rand::thread_rng();
    let first_name = &FIRST_NAMES[rand::random::<usize>() % FIRST_NAMES.len()];
    let last_name = last_names[rand::random::<usize>() % last_names.len()];
    let name = format!("{} {}", first_name, last_name);
    let days = (rand::random::<f64>() * (max_age as f64 - min_age as f64) * 365.0
        + min_age as f64 * 365.0) as i64;
    let time_of_birth = world_time - Duration::days(days);
    let mut skills: Vec<Skill> = vec![];
    let max_level = ((days / 365) / 10) as i32;
    if max_level > 0 {
        for _ in 0..2 {
            let level = if max_level > 1 {
                rng.gen_range(1..=max_level)
            } else {
                1
            };
            let xp = rng.gen_range(get_xp_for_level(level)..get_xp_for_level(level + 1));
            if let Some(skill_type) = SKILL_TYPES
                .iter()
                .filter(|&t| !skills.iter().any(|s| s.skill_type == *t))
                .choose(&mut rng)
            {
                skills.push(Skill {
                    skill_type: *skill_type,
                    level,
                    xp,
                });
            }
        }
    }
    NewInhabitant {
        name,
        date_of_birth: time_of_birth.date(),
        data: InhabitantData {
            health: 100,
            energy: 100,
            skills,
            ..InhabitantData::default()
        },
    }
}

pub fn generate_position() -> (i32, i32) {
    let x = (rand::random::<f64>() * 2600.0) as i32;
    let y = (rand::random::<f64>() * 2600.0) as i32;
    (x, y)
}
