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

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct CraftingRecipe {
    pub min_level: i32,
    pub time: i32, // hours
    pub ingredients: HashMap<String, i32>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct ItemType {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub name_plural: String,
    #[serde(default)]
    pub weapon: bool,
    #[serde(default)]
    pub melee_weapon: bool,
    #[serde(default)]
    pub damage: i32,
    #[serde(default)]
    pub range: i32,
    #[serde(default)]
    pub ammo_type: Option<String>,
    #[serde(default)]
    pub reactivity: i32,
    #[serde(default)]
    pub seed: bool,
    #[serde(default)]
    pub growth_time: i32, // days
    #[serde(default)]
    pub produce: Option<String>,
    #[serde(default)]
    pub food: bool,
    #[serde(default)]
    pub recipe: Option<CraftingRecipe>,
}

lazy_static! {
    pub static ref FIRST_NAMES: Vec<String> =
        load_names("data/first-names.txt").expect("Failed reading first names");
    pub static ref LAST_NAMES: Vec<String> =
        load_names("data/last-names.txt").expect("Failed reading last names");
    pub static ref ITEM_TYPES: HashMap<String, ItemType> =
        load_item_types("data/item").expect("Failed reading item types");
    pub static ref LOCATION_TYPES: HashMap<String, LocationType> =
        load_location_types("data/location").expect("Failed reading location types");
}

fn load_names(path: &str) -> std::io::Result<Vec<String>> {
    let file = File::open(path)?;
    Ok(std::io::BufReader::new(file).lines().flatten().collect())
}

fn load_location_types(dir: &str) -> std::io::Result<HashMap<String, LocationType>> {
    info!("Reading location types from {}", dir);
    let mut map = HashMap::new();
    for entry in read_dir(Path::new(dir))? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
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
            for item_type in location_type.loot.keys() {
                if !ITEM_TYPES.contains_key(item_type) {
                    panic!(
                        "Unknown item type '{}' in loot table of location '{}'",
                        item_type, id
                    );
                }
            }
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

fn load_item_types(dir: &str) -> std::io::Result<HashMap<String, ItemType>> {
    info!("Reading item types from {}", dir);
    let mut map = HashMap::new();
    for entry in read_dir(Path::new(dir))? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            let mut file = File::open(&path)?;
            let mut content = String::new();
            file.read_to_string(&mut content)?;
            let item_type: ItemType = toml::from_str(&content)?;
            let id = path
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .replace(".toml", "");
            map.insert(id.clone(), ItemType { id, ..item_type });
        }
    }
    for item_type in map.values() {
        if let Some(ammo_type) = &item_type.ammo_type {
            if !map.contains_key(ammo_type) {
                panic!(
                    "Unknown ammo type '{}' in item type '{}'",
                    ammo_type, item_type.id
                );
            }
        }
        if let Some(produce) = &item_type.produce {
            if !map.contains_key(produce) {
                panic!(
                    "Unknown produce '{}' in item type '{}'",
                    produce, item_type.id
                );
            }
        }
    }
    Ok(map)
}

pub fn get_item_type(item_type: &str) -> ItemType {
    ITEM_TYPES
        .get(item_type)
        .cloned()
        .unwrap_or_else(|| ItemType {
            id: item_type.to_owned(),
            name: item_type.to_owned(),
            name_plural: item_type.to_owned(),
            ..Default::default()
        })
}
