
pub fn skill_roll(chance: f64, skill_level: i32) -> bool {
    let chances = 1 + skill_level;
    let die_sides = 1.0 / chance;
    let outcomes = die_sides.powi(chances);
    let probability = (outcomes - die_sides.powi(chances - 1)) / outcomes;
    return rand::random::<f64>() < probability;
}

pub fn get_sector_name(sector: (i32, i32)) -> String {
    format!("{}{}", std::char::from_u32(0x41 + sector.0 as u32).unwrap_or('?'), sector.1 + 1)
}

pub fn get_sector(x: i32, y: i32) -> (i32, i32) {
    (x / 100, y / 100)
}
