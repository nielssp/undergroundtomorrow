use chrono::{Duration, NaiveDate, NaiveDateTime};

use crate::{
    data::{FIRST_NAMES, LAST_NAMES},
    db::inhabitants::{InhabitantData, NewInhabitant},
};

pub fn generate_person(
    world_time: NaiveDateTime,
    min_age: i32,
    max_age: i32,
    last_names: &Vec<&String>,
) -> NewInhabitant {
    let first_name = &FIRST_NAMES[rand::random::<usize>() % FIRST_NAMES.len()];
    let last_name = last_names[rand::random::<usize>() % last_names.len()];
    let name = format!("{} {}", first_name, last_name);
    let days = (rand::random::<f64>() * (max_age as f64 - min_age as f64) * 365.0
        + min_age as f64 * 365.0) as i64;
    let time_of_birth = world_time - Duration::days(days);
    NewInhabitant {
        name,
        date_of_birth: time_of_birth.date(),
        data: InhabitantData::default(),
    }
}
