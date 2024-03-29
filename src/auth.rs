/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use actix_web::{cookie::Cookie, post, web, HttpRequest, HttpResponse};
use argonautica::{Hasher, Verifier};
use chrono::Utc;
use rand::Rng;
use sqlx::PgPool;
use tracing::{error, info};

use crate::{
    db::{
        sessions::{self, Session},
        users::{self, User},
    },
    error,
    settings::Settings,
};

#[derive(Debug, serde::Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
    pub remember: Option<bool>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePassword {
    pub existing_password: String,
    pub new_password: String,
}

#[derive(serde::Serialize)]
pub struct SessionUser {
    pub id: i64,
    pub username: String,
    pub admin: bool,
    pub guest: bool,
}

#[derive(Debug, serde::Deserialize)]
pub struct GuestRequest {
    pub accelerated: bool,
}

impl From<User> for SessionUser {
    fn from(user: User) -> Self {
        SessionUser {
            id: user.id,
            username: user.username,
            admin: user.admin,
            guest: user.guest,
        }
    }
}

pub fn config(cfg: &mut web::ServiceConfig) {
    cfg.service(authenticate)
        .service(invalidate)
        .service(set_password)
        .service(get_user)
        .service(register)
        .service(guest)
        .service(finish_registration);
}

#[post("/auth/authenticate")]
async fn authenticate(
    data: web::Json<Credentials>,
    pool: web::Data<PgPool>,
    settings: web::Data<Settings>,
) -> actix_web::Result<HttpResponse> {
    let password = users::get_password_by_username(&pool, &data.username)
        .await?
        .ok_or_else(|| {
            info!("user not found: {}", data.username);
            error::Error::InvalidCredentials
        })?;
    if verify_password(&password.password, &data.password, &settings)? {
        let session_id = generate_session_id();
        let user = users::get_user_by_id(&pool, password.user_id)
            .await?
            .ok_or_else(|| {
                info!("user not found by id: {}", password.user_id);
                error::Error::InvalidCredentials
            })?;
        let lifetime = match data.remember {
            Some(true) => 60 * 24,
            _ => 1,
        };
        sessions::create_session(
            &pool,
            &session_id,
            Utc::now() + chrono::Duration::hours(lifetime),
            user.id,
        )
        .await?;
        info!("user {} authenticated", user.id);
        Ok(HttpResponse::Ok()
            .cookie(
                Cookie::build("ut_session", session_id)
                    .path("/")
                    .max_age(actix_web::cookie::time::Duration::hours(lifetime))
                    .http_only(true)
                    .finish(),
            )
            .json(SessionUser::from(user)))
    } else {
        info!("invalid password");
        Err(error::Error::InvalidCredentials)?
    }
}

#[post("/auth/invalidate")]
async fn invalidate(
    request: HttpRequest,
    pool: web::Data<PgPool>,
) -> actix_web::Result<HttpResponse> {
    let session = validate_session(&request).await?;
    sessions::delete_session(&pool, &session.id).await?;
    if session.user.guest {
        info!("deleted guest user {}", session.user.id);
        users::delete_user(&pool, session.user.id).await?;
    }
    Ok(HttpResponse::Ok().json("OK"))
}

#[post("/auth/set_password")]
async fn set_password(
    request: HttpRequest,
    pool: web::Data<PgPool>,
    data: web::Json<UpdatePassword>,
    settings: web::Data<Settings>,
) -> actix_web::Result<HttpResponse> {
    let session = validate_session(&request).await?;
    let password = users::get_password_by_user_id(&pool, session.user.id)
        .await?
        .ok_or_else(|| {
            error!("user not found by id: {}", session.user.id);
            error::internal_error("User no longer exists")
        })?;
    if verify_password(&password.password, &data.existing_password, &settings)? {
        users::change_password(
            &pool,
            session.user.id,
            &hash_password(&data.new_password, &settings)?,
        )
        .await?;
        Ok(HttpResponse::NoContent().body(""))
    } else {
        Err(error::Error::InvalidCredentials)?
    }
}

#[post("/auth/get_user")]
async fn get_user(request: HttpRequest) -> actix_web::Result<HttpResponse> {
    let session = validate_session(&request).await?;
    Ok(HttpResponse::Ok().json(SessionUser::from(session.user)))
}

#[post("/auth/register")]
async fn register(
    pool: web::Data<PgPool>,
    data: web::Json<users::NewUser>,
    settings: web::Data<Settings>,
) -> actix_web::Result<HttpResponse> {
    let mut user = data.into_inner();
    if user.username.is_empty() {
        Err(error::client_error("EMPTY_USERNAME"))?;
    }
    user.password = hash_password(&user.password, &settings)?;
    user.guest = false;
    let user = users::create_user(&pool, user).await?;
    info!("user {} registered", user.id);
    Ok(HttpResponse::Ok().json(user))
}

#[post("/auth/guest")]
async fn guest(pool: web::Data<PgPool>) -> actix_web::Result<HttpResponse> {
    let number: i32 = rand::thread_rng().gen_range(1..100000);
    let user = users::NewUser {
        username: format!("Guest#{}", number),
        password: "".to_owned(),
        guest: true,
    };
    let user = users::create_user(&pool, user).await?;
    let session_id = generate_session_id();
    let lifetime = 60 * 24;
    sessions::create_session(
        &pool,
        &session_id,
        Utc::now() + chrono::Duration::hours(lifetime),
        user.id,
    )
    .await?;
    info!("guest user {} created", user.id);
    Ok(HttpResponse::Ok()
        .cookie(
            Cookie::build("ut_session", session_id)
                .path("/")
                .max_age(actix_web::cookie::time::Duration::hours(lifetime))
                .http_only(true)
                .finish(),
        )
        .json(SessionUser::from(user)))
}

#[post("/auth/finish_registration")]
async fn finish_registration(
    pool: web::Data<PgPool>,
    data: web::Json<users::NewUser>,
    settings: web::Data<Settings>,
    request: HttpRequest,
) -> actix_web::Result<HttpResponse> {
    let session = validate_session(&request).await?;
    if !session.user.guest {
        Err(error::client_error("NOT_A_GUEST"))?;
    }
    let mut user = data.into_inner();
    if user.username.is_empty() {
        Err(error::client_error("EMPTY_USERNAME"))?;
    }
    user.password = hash_password(&user.password, &settings)?;
    users::update_user(&pool, session.user.id, &user).await?;
    info!("guest user {} completed registration", session.user.id);
    Ok(HttpResponse::NoContent().finish())
}

pub async fn validate_session(request: &HttpRequest) -> actix_web::Result<Session> {
    let pool = request
        .app_data::<web::Data<PgPool>>()
        .ok_or_else(|| error::internal_error("Pool not found"))?;
    request
        .headers()
        .get("X-Underground-Tomorrow")
        .ok_or_else(|| {
            info!("header missing");
            error::Error::Unauthorized
        })?;
    match request.cookie("ut_session") {
        Some(cookie) => {
            let session = sessions::get_session(pool, cookie.value())
                .await?
                .ok_or_else(|| error::Error::Unauthorized)?;
            if session.valid_until >= Utc::now() {
                Ok(session)
            } else {
                info!("session expired");
                sessions::delete_session(pool, &session.id).await?;
                Err(error::Error::Unauthorized)?
            }
        }
        None => {
            info!("cookie not found");
            Err(error::Error::Unauthorized)?
        }
    }
}

pub async fn validate_admin_session(request: &HttpRequest) -> actix_web::Result<Session> {
    let session = validate_session(request).await?;
    if session.user.admin {
        Ok(session)
    } else {
        Err(error::Error::InsufficientPrivileges)?
    }
}

pub fn generate_session_id() -> String {
    let bytes: [u8; 30] = rand::random();
    base64::encode(bytes)
}

pub fn hash_password(password: &str, settings: &Settings) -> Result<String, error::Error> {
    if password.is_empty() {
        return Err(error::client_error("EMPTY_PASSWORD"));
    }
    Hasher::default()
        .configure_iterations(settings.argon2_iterations)
        .configure_memory_size(settings.argon2_memory_size)
        .with_secret_key(&settings.secret_key)
        .with_password(password)
        .hash()
        .map_err(|e| {
            error!("hashing error {}", e);
            error::internal_error("Hashing failed")
        })
}

pub fn verify_password(
    hash: &str,
    password: &str,
    settings: &Settings,
) -> Result<bool, error::Error> {
    if hash.is_empty() || password.is_empty() {
        return Ok(false);
    }
    Verifier::default()
        .with_secret_key(&settings.secret_key)
        .with_hash(hash)
        .with_password(password)
        .verify()
        .map_err(|e| {
            error!("hash verification error {}", e);
            error::internal_error("Hash verification failed")
        })
}

pub async fn cleanup(pool: &PgPool) -> actix_web::Result<()> {
    let deleted = sessions::delete_expired_sessions(pool).await?;
    info!("Expired sessions deleted: {}", deleted);
    Ok(())
}

pub fn start_cleanup_job(pool: PgPool) {
    actix_rt::spawn(async move {
        let mut interval = actix_rt::time::interval(std::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            cleanup(&pool).await.unwrap();
        }
    });
}
