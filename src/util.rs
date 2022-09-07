/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

pub fn roll_dice(chance: f64, rolls: i32) -> bool {
    if rolls < 1 {
        return false;
    }
    let die_sides = 1.0 / chance;
    let probability = 1.0 - ((die_sides - 1.0) / die_sides).powi(rolls);
    rand::random::<f64>() < probability
}

pub fn skill_roll(chance: f64, skill_level: i32) -> bool {
    roll_dice(chance, skill_level + 1)
}

pub fn get_sector_name(sector: (i32, i32)) -> String {
    format!(
        "{}{}",
        std::char::from_u32(0x41 + sector.0 as u32).unwrap_or('?'),
        sector.1 + 1
    )
}

pub fn get_sector(x: i32, y: i32) -> (i32, i32) {
    (x / 100, y / 100)
}

pub fn get_distance(a: (i32, i32), b: (i32, i32)) -> i32 {
    let delta_x = a.0 - b.0;
    let delta_y = a.1 - b.1;
    (((delta_x * delta_x + delta_y * delta_y) as f64).sqrt() * 10.0) as i32
}
