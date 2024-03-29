/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use config::{Config, ConfigError, Environment};

#[derive(serde::Deserialize, Clone)]
pub struct Settings {
    pub listen: String,
    pub host: String,
    pub forwarded: bool,
    pub database: String,
    pub secret_key: String,
    pub argon2_iterations: u32,
    pub argon2_memory_size: u32,
    pub default_admin_username: Option<String>,
    pub default_admin_password: Option<String>,
}

impl Settings {
    pub fn new() -> Result<Self, ConfigError> {
        let mut s = Config::default();
        s.set_default("listen", "127.0.0.1:4014")?;
        s.set_default("host", "https://localhost:4014")?;
        s.set_default("forwarded", false)?;
        s.set_default("argon2_iterations", 64)?;
        s.set_default("argon2_memory_size", 4096)?;
        s.merge(Environment::with_prefix("UT"))?;
        s.try_into()
    }
}
