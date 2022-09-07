/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use rand::{seq::IteratorRandom, Rng};
use tracing::debug;

use crate::{
    data::ITEM_TYPES,
    db::inhabitants::{Inhabitant, SkillType},
    error,
    util::skill_roll,
};

pub fn encounter(
    team: &mut Vec<Inhabitant>,
    report_body: &mut String,
    max_number: i32,
) -> Result<bool, error::Error> {
    if max_number < 1 {
        return Ok(true);
    }
    let stealth_sum: i32 = team
        .iter()
        .map(|i| i.get_skill_level(SkillType::Stealth))
        .sum();
    let stealth_avg = (stealth_sum as f64 / team.len() as f64).ceil() as i32;
    if skill_roll(0.05, stealth_avg) {
        report_body.push_str(&format!("Successfully evaded a band of marauders\n",));
        for member in team {
            member.add_xp(SkillType::Stealth, 60);
        }
    } else {
        let quantity: i32 = if max_number == 1 {
            1
        } else {
            rand::thread_rng().gen_range(1..max_number)
        };
        if quantity == 1 {
            report_body.push_str(&format!("Encountered a single marauder\n"));
        } else {
            report_body.push_str(&format!("Encountered {} marauders\n", quantity));
        }
        let enemy_hp = 50;
        let mut enemies = vec![enemy_hp; quantity as usize];
        let mut range: i32 = rand::thread_rng().gen_range(5..50);
        for member in team.iter_mut() {
            member.data.hp = 50;
        }
        debug!("enemies: {:?}", enemies);
        for _ in 0..(range * 2).min(40) {
            debug!("range: {}", range);
            for member in team.iter_mut() {
                if member.data.hp <= 0 {
                    continue;
                }
                debug!("{} is ready", member.name);
                let mut weapon_range = 1;
                let mut weapon_damage = 1;
                let skill = match &member.data.weapon_type {
                    Some(item_type) => {
                        let weapon = ITEM_TYPES
                            .get(item_type)
                            .ok_or_else(|| error::internal_error("Item type not found"))?;
                        if weapon.melee_weapon {
                            weapon_range = weapon.range;
                            weapon_damage = weapon.damage;
                            SkillType::MeleeWeapons
                        } else if member.data.ammo > 0 {
                            weapon_range = weapon.range;
                            weapon_damage = weapon.damage;
                            SkillType::Guns
                        } else {
                            SkillType::Unarmed
                        }
                    }
                    None => SkillType::Unarmed,
                };
                let hit_chance = (weapon_range as f64 - range as f64 + 1.0) / (weapon_range as f64);
                if hit_chance >= 0.1 {
                    debug!("{} fires", member.name);
                    if skill_roll(hit_chance, member.get_skill_level(skill)) {
                        if let Some(enemy) = enemies
                            .iter_mut()
                            .filter(|e| **e > 0)
                            .choose(&mut rand::thread_rng())
                        {
                            let damage = rand::thread_rng().gen_range(1..weapon_damage + 1);
                            *enemy -= damage;
                            debug!("hit: damage = {}, hp = {}", damage, *enemy);
                            member.add_xp(skill, damage);
                            if *enemy <= 0 {
                                debug!("enemy is dead");
                                report_body
                                    .push_str(&format!("{} killed a marauder\n", member.name,));
                            }
                        }
                    }
                    if skill == SkillType::Guns {
                        member.data.ammo -= 1;
                        if member.data.ammo < 1 {
                            report_body
                                .push_str(&format!("{} ran out of ammunition\n", member.name));
                        }
                    }
                }
            }
            enemies.retain(|&e| e > 0);
            debug!("enemies left: {:?}", enemies);
            if enemies.is_empty() {
                debug!("all enemies dead");
                if quantity > 1 {
                    report_body.push_str(&format!("All {} marauders were killed\n", quantity));
                }
                break;
            }
            for (i, _) in enemies.iter().enumerate() {
                // TODO: stats/abilities for marauders
                debug!("enemey {} is ready", i);
                let weapon_damage = 5;
                let weapon_range = 15;
                let hit_chance = (weapon_range as f64 - range as f64 + 1.0) / (weapon_range as f64);
                if hit_chance >= 0.1 {
                    debug!("enemey {} fires", i);
                    if skill_roll(hit_chance, 0) {
                        if let Some(member) = team
                            .iter_mut()
                            .filter(|m| m.data.hp > 0)
                            .choose(&mut rand::thread_rng())
                        {
                            let damage = rand::thread_rng().gen_range(1..weapon_damage + 1);
                            member.data.hp -= damage;
                            debug!(
                                "enemey {} hits {}: damage = {}, hp = {}",
                                i, member.name, damage, member.data.hp
                            );
                            if member.data.hp < 0 {
                                debug!("{} is incapacitated", member.name);
                                member.data.bleeding = true;
                                member.data.wounded = true;
                                member.data.health -= rand::thread_rng().gen_range(1..50);
                                report_body
                                    .push_str(&format!("{} was incapacitated\n", member.name));
                            }
                        }
                    }
                }
            }
            if !team.iter().any(|m| m.data.hp > 0) {
                debug!("all incapacitated");
                report_body.push_str(&format!("Retreated\n"));
                return Ok(false);
            }
            if range > 0 {
                range -= 1;
            }
        }
        if !enemies.is_empty() {
            report_body.push_str(&format!("Retreated\n"));
            return Ok(false);
        }
    }
    Ok(true)
}
