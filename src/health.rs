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
        if inhabitant.data.surface_exposure > 0 && inhabitant.expedition_id.is_none() {
            inhabitant.data.surface_exposure -= 1;
            inhabitant.changed = true;
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
        if inhabitant.data.sick {
            if inhabitant.data.health >= 25
                && water_quality >= 100
                && air_quality >= 100
                && inhabitant.data.surface_exposure < 1
                && roll_dice(0.01, inhabitant.data.health / 25)
            {
                debug!("{} recovered from disease", inhabitant.name);
                inhabitant.data.sick = false;
            } else {
                inhabitant.data.health -= 1;
            }
            inhabitant.changed = true;
        } else if roll_dice(
            0.01,
            inhabitant.data.surface_exposure + 20 - water_quality * air_quality / 500,
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
