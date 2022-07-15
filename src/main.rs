use actix_web::{get, web::Data, App, HttpResponse, HttpServer};
use dotenv::dotenv;
use sqlx::PgPool;
use tracing::info;
use tracing_actix_web::TracingLogger;

#[macro_use]
extern crate lazy_static;

use crate::settings::Settings;

mod auth;
mod data;
mod db;
mod error;
mod settings;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt()
        .pretty()
        .with_max_level(tracing::Level::DEBUG)
        .init();

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
            .service(health)
            .configure(auth::config)
    })
    .bind(address)?
    .run()
    .await
}

#[get("/health")]
async fn health(pool: Data<PgPool>) -> actix_web::Result<HttpResponse> {
    check_db_health(&pool).await?;
    Ok(HttpResponse::NoContent().finish())
}

async fn check_db_health(pool: &PgPool) -> Result<(), error::Error> {
    sqlx::query("SELECT 1").execute(pool).await?;
    Ok(())
}
