/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createValue } from 'cytoplasmic';
import { Api, ApiContext } from "../api";
import { NewWorld, World } from "../dto";

export class LobbyService {
    constructor(
        private api: Api,
    ) {
    }

    getWorlds() {
        return this.api.rpc<World[]>('lobby/get_worlds');
    }

    createWorld(data: NewWorld) {
        return this.api.rpc<number>('lobby/create_world', data);
    }

    getUsersWorlds() {
        return this.api.rpc<World[]>('lobby/get_user_worlds');
    }

    joinWorld(worldId: number) {
        return this.api.rpc<void>('lobby/join_world', {worldId});
    }
}

export const LobbyServiceContext = createValue(new LobbyService(ApiContext.defaultValue));
