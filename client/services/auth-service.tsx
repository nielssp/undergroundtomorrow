/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ref } from "cstk";
import { Api } from "../api";
import { openConfirm, openDialog } from "../dialog";
import { Credentials, UpdatePassword, User } from "../dto";
import { Register } from "../register";

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
        if (this.user.value?.guest) {
            const action = await openConfirm('If you log out now, you will lose your progress. Are you sure you want to log out?', [
                {
                    text: 'Cancel',
                    role: 'cancel',
                },
                {
                    text: 'Register',
                    role: 'registration',
                },
                {
                    text: 'Log Out',
                    role: 'logout',
                },
            ]);
            if (action !== 'logout') {
                if (action === 'registration') {
                    openDialog(Register, {authService: this});
                }
                return;
            }
        }
        await this.api.rpc<void>('auth/invalidate');
        this.user.value = undefined;
    }

    async register(newUser: Credentials): Promise<User> {
        const user = await this.api.rpc<User>('auth/register', newUser);
        return user;
    }

    async guest(accelerated: boolean): Promise<User> {
        const user = await this.api.rpc<User>('auth/guest', {accelerated});
        this.user.value = user;
        return user;
    }

    async changePassword(update: UpdatePassword) {
        await this.api.rpc<void>('auth/set_password', update);
    }

    async finishRegistration(newUser: Credentials) {
        await this.api.rpc<User>('auth/finish_registration', newUser);
        if (this.user.value) {
            this.user.value.username = newUser.username;
            this.user.value.guest = false;
            this.user.value = this.user.value;
        }
    }
}
