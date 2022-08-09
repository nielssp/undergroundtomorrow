use crate::{db::{bunkers::Bunker, inhabitants::Inhabitant}, error};


pub fn handle_tick(
    bunker: &mut Bunker,
    inhabitants: &mut Vec<Inhabitant>,
) -> Result<(), error::Error> {
    Ok(())
}
