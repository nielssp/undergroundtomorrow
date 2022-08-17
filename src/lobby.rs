use actix_web::{post, web, HttpRequest, HttpResponse};
use futures::future::try_join_all;
use log::warn;
use rand::{seq::IteratorRandom, Rng};
use sqlx::PgPool;

use crate::{
    auth::{generate_session_id, validate_admin_session, validate_session},
    data::{self, ITEM_TYPES, LAST_NAMES},
    db::{
        bunkers::{self, Crop},
        inhabitants::{self, get_xp_for_level, Assignment, Skill, SkillType},
        items, locations, worlds,
    },
    error,
    game::validate_player,
    generate::{self, generate_position},
    util::get_sector,
};

#[derive(serde::Deserialize)]
struct WorldCreationRequest {
    name: String,
    open: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct JoinRequest {
    world_id: i32,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(get_worlds)
        .service(create_world)
        .service(get_user_worlds)
        .service(join_world);
}

#[post("/lobby/get_worlds")]
async fn get_worlds(
    request: HttpRequest,
    pool: web::Data<PgPool>,
) -> actix_web::Result<HttpResponse> {
    let session = validate_session(&request).await?;
    Ok(HttpResponse::Ok().json(worlds::get_worlds(&pool, session.user.id).await?))
}

#[post("/lobby/create_world")]
async fn create_world(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    data: web::Json<worlds::NewWorld>,
) -> actix_web::Result<HttpResponse> {
    validate_admin_session(&request).await?;
    let request_data = data.into_inner();
    let world_id = worlds::create_world(&pool, &request_data).await?;
    for location_type in data::LOCATION_TYPES.values() {
        for i in 0..location_type.quantity {
            let (x, y) = generate_position();
            let name = format!("{} {}", location_type.name, i + 1);
            locations::create_location(
                &pool,
                &locations::NewLocation {
                    world_id,
                    name,
                    x,
                    y,
                    data: locations::LocationData {
                        location_type: location_type.id.clone(),
                        searches: 0,
                    },
                },
            )
            .await?;
        }
    }
    Ok(HttpResponse::Ok().json(world_id))
}

#[post("/lobby/get_user_worlds")]
async fn get_user_worlds(
    request: HttpRequest,
    pool: web::Data<PgPool>,
) -> actix_web::Result<HttpResponse> {
    let session = validate_session(&request).await?;
    Ok(HttpResponse::Ok().json(worlds::get_user_worlds(&pool, session.user.id).await?))
}

#[post("/lobby/join_world")]
async fn join_world(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    data: web::Json<JoinRequest>,
) -> actix_web::Result<HttpResponse> {
    let session = validate_session(&request).await?;
    let request_data = data.into_inner();
    let world = worlds::get_world(&pool, request_data.world_id).await?;
    let bunker_number = 1 + bunkers::get_max_bunker_number(&pool, request_data.world_id)
        .await?
        .unwrap_or(0);
    let (x, y) = generate_position();
    let mut rng = rand::thread_rng();
    let mut food_required = 25 * 3;
    let mut crops = vec![];
    while food_required > 0 {
        let seed_type = ITEM_TYPES
            .values()
            .filter(|it| it.seed)
            .choose(&mut rng)
            .ok_or_else(|| error::internal_error("No seeds found"))?;
        let quantity: i32 = rng.gen_range(400..1000);
        crops.push(Crop {
            seed_type: seed_type.id.clone(),
            name: seed_type.name_plural.clone(),
            quantity,
            stage: seed_type.growth_time,
            max: seed_type.growth_time,
            stunted: false,
            diseased: false,
        });
        food_required -= quantity / seed_type.growth_time;
    }
    let bunker_id = bunkers::create_bunker(
        &pool,
        &bunkers::NewBunker {
            user_id: session.user.id,
            world_id: request_data.world_id,
            number: bunker_number,
            x,
            y,
            broadcast_id: generate_session_id(),
            data: bunkers::BunkerData {
                reactor: bunkers::ReactorStatus {
                    maintenance: 100,
                    fuel: 300,
                    malfunction: false,
                    parts: 20,
                },
                water_treatment: bunkers::WaterTreatmentStatus {
                    maintenance: 100,
                    malfunction: false,
                    parts: 20,
                },
                infirmary: bunkers::InfirmaryStatus { medicine: 25 },
                workshop: bunkers::WorkshopStatus { projects: vec![] },
                horticulture: bunkers::HorticultureStatus { crops },
                air_recycling: bunkers::AirRecyclingStatus {
                    maintenance: 100,
                    malfunction: false,
                    parts: 20,
                },
                cafeteria: bunkers::CafeteriaStatus { food: 25 * 6 },
            },
        },
    )
    .await?;
    let world_time = world.now();
    let mut last_names: Vec<&String> = Vec::with_capacity(20);
    for _ in 0..20 {
        last_names.push(&LAST_NAMES[rand::random::<usize>() % LAST_NAMES.len()]);
    }
    for _ in 0..5 {
        let person = generate::generate_person(world_time, 0, 18, &last_names);
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    let mut assignments = vec![
        Assignment::Reactor,
        Assignment::Reactor,
        Assignment::Infirmary,
        Assignment::Infirmary,
        Assignment::Horticulture,
        Assignment::Horticulture,
        Assignment::Workshop,
        Assignment::Workshop,
        Assignment::WaterTreatment,
        Assignment::WaterTreatment,
        Assignment::AirRecycling,
        Assignment::AirRecycling,
        Assignment::Cafeteria,
        Assignment::Cafeteria,
    ]
    .into_iter();
    for _ in 0..15 {
        let mut person = generate::generate_person(world_time, 19, 50, &last_names);
        if let Some(assignment) = assignments.next() {
            person.data.assignment = Some(assignment);
            let skill_type = match assignment {
                Assignment::Reactor => SkillType::Reactor,
                Assignment::Infirmary => SkillType::Medicine,
                Assignment::Horticulture => SkillType::Botany,
                Assignment::Workshop => SkillType::Crafting,
                Assignment::WaterTreatment => SkillType::Repair,
                Assignment::AirRecycling => SkillType::Repair,
                Assignment::Cafeteria => SkillType::Cooking,
            };
            let min_level =
                (((world_time.date() - person.date_of_birth).num_days() / 365) / 10) as i32;
            let max_level = min_level + 4;
            let level = rng.gen_range(min_level..=max_level);
            let xp = rng.gen_range(get_xp_for_level(level)..get_xp_for_level(level + 1));
            if let Some(skill) = person
                .data
                .skills
                .iter_mut()
                .find(|skill| skill.skill_type == skill_type)
            {
                skill.level = level;
                skill.xp = xp;
            } else {
                person.data.skills.push(Skill {
                    skill_type,
                    level,
                    xp,
                });
            }
        }
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    for _ in 0..5 {
        let person = generate::generate_person(world_time, 51, 100, &last_names);
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    items::add_item(&pool, bunker_id, "fuel-rod-10", 1).await?;
    let sector = get_sector(x, y);
    locations::add_all_bunker_locations_in_sector(&pool, world.id, bunker_id, sector).await?;
    locations::add_bunker_sector(&pool, bunker_id, sector.0, sector.1).await?;
    Ok(HttpResponse::NoContent().finish())
}
