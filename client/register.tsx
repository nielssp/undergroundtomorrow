/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { bind, createElement, Field, TextControl } from "cstk";
import { openAlert } from "./dialog";
import { handleError } from "./error";
import { AuthService } from "./services/auth-service";

export function Register({authService, close}: {
    authService: AuthService,
    close: (done: boolean) => void,
}, context: JSX.Context) {
    const loading = bind(false);
    const usernameControl = new TextControl('');
    const passwordControl = new TextControl('');
    const confirmPasswordControl = new TextControl('');

    async function submit(event: Event) {
        event.preventDefault();

        const username = usernameControl.value;
        const password = passwordControl.value;
        const confirmPassword = confirmPasswordControl.value;
        if (password !== confirmPassword) {
            openAlert('Password mismatch');
            return;
        }
        loading.value = true;
        try {
            if (authService.user.value?.guest) {
                await authService.finishRegistration({username, password});
            } else {
                await authService.register({username, password});
                await authService.authenticate({username, password, remember: true});
            }
            close(true);
        } catch (error: any) {
            switch (error?.code) {
                case 'USERNAME_TAKEN':
                    openAlert('The name is not available');
                    break;
                default:
                    handleError(error);
                    break;
            }
        } finally {
            loading.value = false;
        }
    }
    
    context.onInit(() => {
        usernameControl.focus();
    });

    return <form class='padding stack-column spacing' onSubmit={submit}>
        <div class='stack-row spacing justify-space-between'>
            <Field control={usernameControl}>
                <label>Username:</label>
                <input type='text' required disabled={loading}/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={passwordControl}>
                <label>Password:</label>
                <input type='password' required disabled={loading}/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={confirmPasswordControl}>
                <label>Confirm Password:</label>
                <input type='password' required disabled={loading}/>
            </Field>
        </div>
        <div class='stack-row spacing justify-end'>
            <button type='button' onClick={() => close(false)} disabled={loading}>Cancel</button>
            <button type='submit' disabled={loading}>Register</button>
        </div>
    </form>;
}
