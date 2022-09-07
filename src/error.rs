/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use log::{error, info, warn};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("INTERNAL_ERROR")]
    InternalError(String),
    #[error("DATABASE_ERROR")]
    SqlxError(#[from] sqlx::error::Error),
    #[error("INVALID_CREDENTIALS")]
    InvalidCredentials,
    #[error("USERNAME_TAKEN")]
    UsernameTaken,
    #[error("NAME_TAKEN")]
    NameTaken,
    #[error("UNAUTHORIZED")]
    Unauthorized,
    #[error("INSUFFICIENT_PRIVILEGES")]
    InsufficientPrivileges,
    #[error("CLIENT_ERROR")]
    ClientError(String),
    #[error("GAME_FULL")]
    GameFull,
}

impl actix_web::error::ResponseError for Error {
    fn error_response(&self) -> actix_web::HttpResponse<actix_web::body::BoxBody> {
        match *self {
            Error::InternalError(ref msg) => {
                error!("Internal error: {}", msg);
                actix_web::HttpResponse::InternalServerError().json("INTERNAL_ERROR")
            }
            Error::SqlxError(ref error) => {
                error!("Database error: {:?}", error);
                actix_web::HttpResponse::InternalServerError().json("INTERNAL_ERROR")
            }
            Error::Unauthorized => actix_web::HttpResponse::Unauthorized().json(self.to_string()),
            Error::InsufficientPrivileges => {
                warn!("Insufficient privileges");
                actix_web::HttpResponse::Forbidden().json(self.to_string())
            }
            Error::ClientError(ref error) => {
                warn!("Client error: {}", error);
                actix_web::HttpResponse::BadRequest().json(error)
            }
            _ => {
                info!("Misc client error: {:?}", self);
                actix_web::HttpResponse::BadRequest().json(self.to_string())
            }
        }
    }
}

pub fn internal_error(error: &str) -> Error {
    Error::InternalError(error.to_owned())
}

pub fn client_error(error: &str) -> Error {
    Error::ClientError(error.to_owned())
}
