use actix::Actor;
use actix_web::{get, web::Data, App, HttpResponse, HttpServer};
use dotenv::dotenv;
use sqlx::PgPool;
use tracing::info;
use tracing_actix_web::TracingLogger;

#[macro_use]
extern crate lazy_static;

use crate::settings::Settings;

mod air_recycling;
mod auth;
mod battle;
mod cafeteria;
mod data;
mod db;
mod dto;
mod error;
mod expedition;
mod game;
mod game_loop;
mod generate;
mod health;
mod horticulture;
mod infirmary;
mod lobby;
mod reactor;
mod settings;
mod util;
mod water_treatment;
mod workshop;
mod broadcaster;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .pretty()
        .init();

    info!("{} first names loaded", data::FIRST_NAMES.len());
    info!("{} last names loaded", data::LAST_NAMES.len());
    info!("{} location types loaded", data::LOCATION_TYPES.len());
    info!("{} item types loaded", data::ITEM_TYPES.len());
    info!("{}x{} world map loaded", data::WORLD_MAP.width(), data::WORLD_MAP.height());

    info!("Starting Underground Tomorrow server...");

    let settings = Settings::new().expect("Failed reading settings");

    info!("Connecting to database...");

    let pool = sqlx::PgPool::connect(&settings.database)
        .await
        .expect("Failed connecting to database");

    info!("Running migrations...");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed running migrations");

    auth::start_cleanup_job(pool.clone());

    let broadcaster = broadcaster::Broadcaster::new().start();

    game_loop::start_loop(pool.clone(), broadcaster.clone());

    let address = settings.listen.clone();

    info!("Starting HTTP server...");

    HttpServer::new(move || {
        let mut cors = actix_cors::Cors::default()
            .allow_any_method()
            .allow_any_header()
            .allowed_origin(&format!("http://{}", settings.listen));
        for host in settings.host.split(",") {
            cors = cors.allowed_origin(host);
        }
        App::new()
            .wrap(TracingLogger::default())
            .wrap(cors)
            .app_data(Data::new(settings.clone()))
            .app_data(Data::new(pool.clone()))
            .app_data(Data::new(broadcaster.clone()))
            .service(health_check)
            .configure(auth::config)
            .configure(lobby::config)
            .configure(game::config)
    })
    .bind(address)?
    .run()
    .await
}

#[get("/health")]
async fn health_check(pool: Data<PgPool>) -> actix_web::Result<HttpResponse> {
    check_db_health(&pool).await?;
    Ok(HttpResponse::NoContent().finish())
}

async fn check_db_health(pool: &PgPool) -> Result<(), error::Error> {
    sqlx::query("SELECT 1").execute(pool).await?;
    Ok(())
}
