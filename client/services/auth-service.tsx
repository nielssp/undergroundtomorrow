import { ref } from "cstk";
import { Api } from "../api";
import { Credentials, User } from "../dto";

export class AuthService {
    readonly user = ref<User>();

    constructor(
        private api: Api,
    ) {
    }

    async getUser(): Promise<User|undefined> {
        try {
            const user = await this.api.rpc<User>('auth/get_user');
            this.user.value = user;
            return user;
        } catch {
            return undefined;
        }
    }

    async authenticate(credentials: Credentials): Promise<User> {
        const user = await this.api.rpc<User>('auth/authenticate', credentials);
        this.user.value = user;
        return user;
    }

    async invalidate(): Promise<void> {
        await this.api.rpc<void>('auth/invalidate');
        this.user.value = undefined;
    }

    async register(newUser: Credentials): Promise<User> {
        const user = await this.api.rpc<User>('auth/register', newUser);
        this.user.value = user;
        return user;
    }
}
