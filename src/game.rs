use actix_web::{post, web, HttpRequest, HttpResponse};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tracing::info;

use crate::{
    auth::validate_session,
    db::{
        bunkers::{self, Bunker},
        inhabitants, items,
        sessions::Session,
        worlds, messages,
    },
    error,
};

pub struct Player {
    world_id: i32,
    bunker: Bunker,
    session: Session,
}

#[derive(serde::Deserialize)]
pub struct MessageQuery {
    older_than: Option<DateTime<Utc>>,
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(get_world)
        .service(get_bunker)
        .service(get_inhabitants)
        .service(get_items)
        .service(get_messages);
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
    Ok(HttpResponse::Ok().json(inhabitants::get_inhabitants(&pool, player.bunker.id).await?))
}

#[post("/world/{world_id:\\d+}/get_items")]
async fn get_items(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(items::get_items(&pool, player.bunker.id).await?))
}

#[post("/world/{world_id:\\d+}/get_messages")]
async fn get_messages(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    world_id: web::Path<i32>,
    query: web::Query<MessageQuery>,
) -> actix_web::Result<HttpResponse> {
    let player = validate_player(&request, world_id.into_inner()).await?;
    Ok(HttpResponse::Ok().json(messages::get_messages(&pool, player.bunker.id, query.older_than).await?))
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
