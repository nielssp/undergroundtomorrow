use actix_web::{post, web, HttpRequest, HttpResponse};
use chrono::{DateTime, Duration, Utc};
use itertools::Itertools;
use sqlx::PgPool;
use tracing::info;

use crate::{
    auth::validate_session,
    db::{
        bunkers::{self, Bunker},
        expeditions, inhabitants, items, locations, messages,
        sessions::Session,
        worlds,
    },
    dto::{InhabitantDto, ItemDto, LocationDto},
    error, expedition,
};

pub struct Player {
    pub world_id: i32,
    pub bunker: Bunker,
    pub session: Session,
}

#[derive(serde::Deserialize)]
struct MessageQuery {
    older_than: Option<DateTime<Utc>>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetTeamRequest {
    inhabitant_id: i32,
    team: Option<String>,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(get_world)
        .service(get_bunker)
        .service(get_inhabitants)
        .service(set_team)
        .service(get_items)
        .service(get_locations)
        .service(get_sectors)
        .service(get_messages)
        .service(set_message_read)
        .service(has_unread_messages)
        .service(get_expeditions)
        .service(create_expedition);
}

#[post("/world/{world_id:\\d+}/get_world")]
async fn get_world(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    let world = worlds::get_world(&pool, player.world_id).await?;
    Ok(HttpResponse::Ok().json(world))
}

#[post("/world/{world_id:\\d+}/get_bunker")]
async fn get_bunker(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(player.bunker))
}

#[post("/world/{world_id:\\d+}/get_inhabitants")]
async fn get_inhabitants(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    let inhabitants: Vec<InhabitantDto> = inhabitants::get_inhabitants(&pool, player.bunker.id)
        .await?
        .into_iter()
        .map(|p| p.into())
        .collect();
    Ok(HttpResponse::Ok().json(inhabitants))
}

#[post("/world/{world_id:\\d+}/set_team")]
async fn set_team(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
    data: web::Json<SetTeamRequest>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    let mut inhabitant = inhabitants::get_inhabitant(&pool, player.bunker.id, data.inhabitant_id)
        .await?
        .ok_or_else(|| error::client_error("INHABITANT_NOT_FOUND"))?;
    inhabitant.data.team = data.into_inner().team;
    inhabitants::update_inhabitant_data(&pool, &inhabitant).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[post("/world/{world_id:\\d+}/get_items")]
async fn get_items(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    let items: Vec<ItemDto> = items::get_items(&pool, player.bunker.id)
        .await?
        .into_iter()
        .map(|i| i.into())
        .collect();
    Ok(HttpResponse::Ok().json(items))
}

#[post("/world/{world_id:\\d+}/get_locations")]
async fn get_locations(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    let locations: Vec<LocationDto> = locations::get_discovered_locations(&pool, player.bunker.id)
        .await?
        .into_iter()
        .map(|l| l.into())
        .collect();
    Ok(HttpResponse::Ok().json(locations))
}

#[post("/world/{world_id:\\d+}/get_sectors")]
async fn get_sectors(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(locations::get_explored_sectors(&pool, player.bunker.id).await?))
}

#[post("/world/{world_id:\\d+}/get_messages")]
async fn get_messages(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
    query: web::Query<MessageQuery>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    Ok(HttpResponse::Ok()
        .json(messages::get_messages(&pool, player.bunker.id, query.older_than).await?))
}

#[post("/world/{world_id:\\d+}/set_message_read")]
async fn set_message_read(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
    data: web::Json<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    messages::set_message_read(&pool, player.bunker.id, data.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[post("/world/{world_id:\\d+}/has_unread_messages")]
async fn has_unread_messages(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(messages::unread_messages_exist(&pool, player.bunker.id).await?))
}

#[post("/world/{world_id:\\d+}/get_expeditions")]
async fn get_expeditions(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(expeditions::get_expeditions(&pool, player.bunker.id).await?))
}

#[post("/world/{world_id:\\d+}/create_expedition")]
async fn create_expedition(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
    data: web::Json<expedition::ExpeditionRequest>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    let expedition_request = data.into_inner();
    expedition::create(&pool, player.world_id, &player.bunker, expedition_request).await?;
    Ok(HttpResponse::NoContent().finish())
}

pub async fn validate_player(request: &HttpRequest, world_id: i32) -> actix_web::Result<Player> {
    let pool = request
        .app_data::<web::Data<PgPool>>()
        .ok_or_else(|| error::internal_error("Pool missing"))?;
    let session = validate_session(request).await?;
    let bunker = bunkers::get_bunker_by_world_and_user(&pool, world_id, session.user.id)
        .await?
        .ok_or_else(|| {
            info!(session.user.id, world_id, "player not found in world");
            error::client_error("NATION_NOT_FOUND")
        })?;
    Ok(Player {
        world_id,
        bunker,
        session,
    })
}
