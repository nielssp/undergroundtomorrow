/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
export const environment = {
    apiUrl: `${location.origin}/api`,
    websocketUrl: `${wsProtocol}://${location.hostname}:4014/events`
};

export type Environment = typeof environment;
