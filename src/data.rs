use std::{
    collections::HashMap,
    fs::{read_dir, File},
    io::{BufRead, Read},
    path::Path,
};

use tracing::info;

lazy_static! {
    pub static ref FIRST_NAMES: Vec<String> =
        load_names("data/first-names.txt").expect("Failed reading first names");
    pub static ref LAST_NAMES: Vec<String> =
        load_names("data/last-names.txt").expect("Failed reading last names");
}

fn load_names(path: &str) -> std::io::Result<Vec<String>> {
    let file = File::open(path)?;
    Ok(std::io::BufReader::new(file).lines().flatten().collect())
}
