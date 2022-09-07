/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Environment } from "./environment";

export const environment: Environment = {
    apiUrl: `/api`,
    websocketUrl: `wss://${location.hostname}/api/events`
};

