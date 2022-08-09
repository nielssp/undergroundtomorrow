use actix_web::{post, web, HttpRequest, HttpResponse};
use futures::future::try_join_all;
use log::warn;
use sqlx::PgPool;

use crate::{
    auth::{validate_admin_session, validate_session},
    data::{self, LAST_NAMES},
    db::{bunkers, inhabitants, locations, worlds},
    error,
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
                        abundance: 1.0,
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
    let bunker_id = bunkers::create_bunker(
        &pool,
        &bunkers::NewBunker {
            user_id: session.user.id,
            world_id: request_data.world_id,
            number: bunker_number,
            x,
            y,
            data: bunkers::BunkerData {
                scrap_metal: 10,
                scrap_electronics: 10,
                reactor: bunkers::ReactorStatus {
                    maintenance: 100,
                    fuel: 160,
                    malfunction: false,
                    parts: 20,
                },
                water_treatment: bunkers::WaterTreatmentStatus {
                    maintenance: 100,
                    malfunction: false,
                    parts: 20,
                },
                infirmary: bunkers::InfirmaryStatus { medicine: 10 },
                workshop: bunkers::WorkshopStatus { projects: vec![] },
                horticulture: bunkers::HorticultureStatus { crops: vec![] },
                air_recycling: bunkers::AirRecyclingStatus {
                    maintenance: 100,
                    malfunction: false,
                    parts: 20,
                },
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
    for _ in 0..15 {
        let person = generate::generate_person(world_time, 19, 50, &last_names);
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    for _ in 0..5 {
        let person = generate::generate_person(world_time, 51, 100, &last_names);
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    // TODO: starting items
    // TODO: initial locations?
    let sector = get_sector(x, y);
    locations::add_all_bunker_locations_in_sector(&pool, world.id, bunker_id, sector).await?;
    locations::add_bunker_sector(&pool, bunker_id, sector.0, sector.1).await?;
    Ok(HttpResponse::Ok().json("OK"))
}
