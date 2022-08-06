use rand::{
    seq::{IteratorRandom, SliceRandom},
    Rng,
};

use crate::{
    data::ITEM_TYPES,
    db::inhabitants::{self, Inhabitant, SkillType},
    error,
    util::skill_roll,
};

pub fn encounter(
    team: &mut Vec<Inhabitant>,
    report_body: &mut String,
) -> Result<bool, error::Error> {
    let stealth_sum: i32 = team
        .iter()
        .map(|i| inhabitants::get_inhabitant_skill_level(i, SkillType::Stealth))
        .sum();
    let stealth_avg = (stealth_sum as f64 / team.len() as f64).ceil() as i32;
    if skill_roll(0.2, stealth_avg) {
        report_body.push_str(&format!("Successfully evaded a band of marauders\n",));
        for mut member in team {
            inhabitants::add_xp_to_skill(&mut member, SkillType::Stealth, 60);
        }
    } else {
        let quantity: i32 = rand::thread_rng().gen_range(1..10);
        if quantity == 1 {
            report_body.push_str(&format!("Encountered a single marauder\n"));
        } else {
            report_body.push_str(&format!("Encountered {} marauders\n", quantity));
        }
        let enemy_hp = 50;
        let mut enemies = vec![enemy_hp, quantity];
        enemies.iter_mut().for_each(|e| *e = 100);
        let mut range: i32 = rand::thread_rng().gen_range(5..50);
        for member in team.iter_mut() {
            member.data.hp = 50;
        }
        for _ in 0..(range * 2) {
            for mut member in team.iter_mut() {
                if member.data.hp <= 0 {
                    continue;
                }
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
                    if skill_roll(
                        hit_chance,
                        inhabitants::get_inhabitant_skill_level(member, skill),
                    ) {
                        if let Some(enemy) = enemies
                            .iter_mut()
                            .filter(|e| **e > 0)
                            .choose(&mut rand::thread_rng())
                        {
                            let damage = rand::thread_rng().gen_range(1..weapon_damage + 1);
                            *enemy -= damage;
                            inhabitants::add_xp_to_skill(&mut member, skill, damage);
                            if *enemy <= 0 {
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
            enemies.retain(|e| *e > 0);
            if enemies.is_empty() {
                if quantity > 1 {
                    report_body.push_str(&format!("All {} marauders were killed\n", quantity));
                }
                break;
            }
            for _ in &enemies {
                // TODO: stats/abilities for marauders
                let weapon_damage = 5;
                let weapon_range = 15;
                let hit_chance = (weapon_range as f64 - range as f64 + 1.0) / (weapon_range as f64);
                if hit_chance >= 0.1 {
                    if skill_roll(hit_chance, 0) {
                        if let Some(member) = team
                            .iter_mut()
                            .filter(|m| m.data.hp > 0)
                            .choose(&mut rand::thread_rng())
                        {
                            let damage = rand::thread_rng().gen_range(1..weapon_damage + 1);
                            member.data.hp -= damage;
                            if member.data.hp < 0 {
                                report_body
                                    .push_str(&format!("{} was incapacitated\n", member.name));
                            }
                        }
                    }
                }
            }
            if !team.iter().any(|m| m.data.hp > 0) {
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
