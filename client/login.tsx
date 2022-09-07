/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { bind, createElement, Field, TextControl } from "cstk";
import { openAlert } from "./dialog";
import { handleError } from "./error";
import { AuthService } from "./services/auth-service";

export function Login({authService}: {
    authService: AuthService,
}) {
    const loading = bind(false);
    const usernameControl = new TextControl('');
    const passwordControl = new TextControl('');

    async function submit(event: Event) {
        event.preventDefault();

        const username = usernameControl.value;
        const password = passwordControl.value;
        const remember = true;
        loading.value = true;
        try {
            await authService.authenticate({username, password, remember});
            passwordControl.value = '';
        } catch (error: any) {
            switch (error?.code) {
                case 'INVALID_CREDENTIALS':
                    openAlert('Incorrect username or password');
                    break;
                default:
                    handleError(error);
                    break;
            }
        } finally {
            loading.value = false;
        }
    }

    return <form onSubmit={submit}>
        <div class='margin-bottom'>
            <Field control={usernameControl}>
                <label>Username:</label>
                <input type='text' disabled={loading}/>
            </Field>
        </div>
        <div class='margin-bottom'>
            <Field control={passwordControl}>
                <label>Password:</label>
                <input type='password' disabled={loading}/>
            </Field>
        </div>
        <div>
            <button type='submit' disabled={loading}>Log In</button>
        </div>
    </form>;
}
