use actix_web::{post, web, HttpRequest, HttpResponse};
use futures::future::try_join_all;
use log::warn;
use sqlx::PgPool;

use crate::{
    auth::{validate_admin_session, validate_session},
    db::{bunkers, inhabitants, worlds},
    error, generate,
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
    let x = (rand::random::<f64>() * 2600.0) as i32;
    let y = (rand::random::<f64>() * 2600.0) as i32;
    let bunker_id = bunkers::create_bunker(
        &pool,
        &bunkers::NewBunker {
            user_id: session.user.id,
            world_id: request_data.world_id,
            number: bunker_number,
            x,
            y,
            data: bunkers::BunkerData {},
        },
    )
    .await?;
    let world_time = worlds::get_world_time(&world);
    for _ in 0..5 {
        let person = generate::generate_person(world_time, 0, 18);
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    for _ in 0..15 {
        let person = generate::generate_person(world_time, 19, 50);
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    for _ in 0..5 {
        let person = generate::generate_person(world_time, 51, 100);
        inhabitants::create_inhabitant(&pool, bunker_id, &person).await?;
    }
    // TODO: starting items
    // TODO: initial locations?
    Ok(HttpResponse::Ok().json("OK"))
}
