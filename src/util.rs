
pub fn skill_roll(chance: f64, skill_level: i32) -> bool {
    let chances = 1 + skill_level;
    let die_sides = 1.0 / chance;
    let outcomes = die_sides.powi(chances);
    let probability = (outcomes - die_sides.powi(chances - 1)) / outcomes;
    return rand::random::<f64>() < probability;
}
