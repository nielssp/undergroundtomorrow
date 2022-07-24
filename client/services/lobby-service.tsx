import {Api} from "../api";
import {NewWorld, World} from "../dto";

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

