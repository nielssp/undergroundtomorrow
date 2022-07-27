use std::{
    collections::HashMap,
    fs::{read_dir, File},
    io::{BufRead, Read},
    path::Path,
};

use tracing::info;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct LootEntry {
    pub min: i32,
    pub max: i32,
    pub chance: f64,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct LocationType {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub quantity: i32,
    #[serde(default)]
    pub loot: HashMap<String, LootEntry>,
}

lazy_static! {
    pub static ref FIRST_NAMES: Vec<String> =
        load_names("data/first-names.txt").expect("Failed reading first names");
    pub static ref LAST_NAMES: Vec<String> =
        load_names("data/last-names.txt").expect("Failed reading last names");
    pub static ref LOCATION_TYPES: HashMap<String, LocationType> =
        load_location_types("data/location").expect("Failed reading location types");
}

fn load_names(path: &str) -> std::io::Result<Vec<String>> {
    let file = File::open(path)?;
    Ok(std::io::BufReader::new(file).lines().flatten().collect())
}

fn load_location_types(dir: &str) -> std::io::Result<HashMap<String, LocationType>> {
    info!("Reading techs from {}", dir);
    let mut map = HashMap::new();
    for entry in read_dir(Path::new(dir))? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            // recurse?
        } else {
            let mut file = File::open(&path)?;
            let mut content = String::new();
            file.read_to_string(&mut content)?;
            let location_type: LocationType = toml::from_str(&content)?;
            let id = path
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .replace(".toml", "");
            map.insert(
                id.clone(),
                LocationType {
                    id,
                    ..location_type
                },
            );
        }
    }
    Ok(map)
}
