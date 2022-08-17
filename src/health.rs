use tracing::debug;

use crate::{
    db::{bunkers::Bunker, inhabitants::Inhabitant},
    error,
    util::roll_dice,
};

pub fn handle_tick(
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
    water_quality: i32,
    air_quality: i32,
) -> Result<(), error::Error> {
    for inhabitant in inhabitants {
        inhabitant.data.hunger += 1;
        inhabitant.data.tiredness += 1;
        if inhabitant.data.hunger >= 12 {
            if inhabitant.expedition_id.is_none() && bunker.data.cafeteria.food > 0 {
                bunker.data.cafeteria.food -= 1;
                inhabitant.data.hunger -= 12;
                inhabitant.data.starving = false;
            } else if inhabitant.data.hunger >= 36 {
                inhabitant.data.starving = true;
            }
        }
        if inhabitant.expedition_id.is_none() {
            if air_quality < 100 || water_quality < 100 {
                if air_quality < 100 && water_quality < 100 {
                    inhabitant.data.surface_exposure += 4;
                } else {
                    inhabitant.data.surface_exposure += 2;
                }
            } else if inhabitant.data.surface_exposure > 0 {
                inhabitant.data.surface_exposure -= 1;
            }
            if inhabitant.data.tiredness >= 16 {
                inhabitant.data.sleeping = true;
            }
        } else {
            inhabitant.data.sleeping = false;
        }
        if inhabitant.data.sleeping {
            if inhabitant.data.tiredness > 1 {
                inhabitant.data.tiredness -= 2;
            } else {
                inhabitant.data.sleeping = false;
            }
        }
        if inhabitant.data.bleeding {
            inhabitant.data.health -= 10;
            inhabitant.changed = true;
        }
        if inhabitant.data.wounded {
            if !inhabitant.data.infection {
                if roll_dice(0.05, 100 - inhabitant.data.health) {
                    inhabitant.data.infection = true;
                    inhabitant.changed = true;
                } else if inhabitant.data.health >= 25
                    && roll_dice(0.01, inhabitant.data.health / 25)
                {
                    inhabitant.data.wounded = false;
                    inhabitant.changed = true;
                }
            }
        }
        if inhabitant.data.infection {
            inhabitant.data.health -= 6;
            inhabitant.changed = true;
        }
        if inhabitant.data.starving {
            inhabitant.data.health -= 1;
            inhabitant.changed = true;
        }
        if inhabitant.data.sick {
            if inhabitant.data.health >= 25
                && inhabitant.data.surface_exposure < 1
                && roll_dice(0.01, inhabitant.data.health / 25)
            {
                debug!("{} recovered from disease", inhabitant.name);
                inhabitant.data.sick = false;
            } else {
                inhabitant.data.health -= 2;
            }
            inhabitant.changed = true;
        } else if roll_dice(
            0.01,
            inhabitant.data.surface_exposure + (inhabitant.data.tiredness - 24).max(0),
        ) {
            debug!("{} got sick", inhabitant.name);
            inhabitant.data.sick = true;
            inhabitant.data.recovering = false;
            inhabitant.changed = true;
        }
        if !inhabitant.data.bleeding
            && !inhabitant.data.infection
            && !inhabitant.data.wounded
            && !inhabitant.data.sick
            && !inhabitant.data.starving
        {
            if inhabitant.data.health < 100 {
                inhabitant.data.health += 1;
                inhabitant.data.recovering = true;
                inhabitant.changed = true;
            } else if inhabitant.data.recovering {
                inhabitant.data.recovering = false;
                inhabitant.changed = true;
            }
        } else if inhabitant.data.recovering {
            inhabitant.data.recovering = false;
            inhabitant.changed = true;
        }
    }
    Ok(())
}
