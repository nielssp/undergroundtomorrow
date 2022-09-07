/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { bind, createElement, Field, TextControl } from "cstk";
import { openAlert } from "./dialog";
import { handleError } from "./error";
import { AuthService } from "./services/auth-service";

export function ChangePassword({authService, close}: {
    authService: AuthService,
    close: (done: boolean) => void,
}, context: JSX.Context) {
    const loading = bind(false);
    const existingPasswordControl = new TextControl('');
    const passwordControl = new TextControl('');
    const confirmPasswordControl = new TextControl('');

    async function submit(event: Event) {
        event.preventDefault();

        const existingPassword = existingPasswordControl.value;
        const newPassword = passwordControl.value;
        const confirmPassword = confirmPasswordControl.value;
        if (newPassword !== confirmPassword) {
            openAlert('Password mismatch');
            return;
        }
        loading.value = true;
        try {
            await authService.changePassword({existingPassword, newPassword});
            close(true);
        } catch (error: any) {
            switch (error?.code) {
                case 'INVALID_CREDENTIALS':
                    openAlert('Incorrect password');
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
        existingPasswordControl.focus();
    });

    return <form class='padding stack-column spacing' onSubmit={submit}>
        <div class='stack-row spacing justify-space-between'>
            <Field control={existingPasswordControl}>
                <label>Existing Password:</label>
                <input type='password' required disabled={loading}/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={passwordControl}>
                <label>New Password:</label>
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
            <button type='submit' disabled={loading}>Change</button>
        </div>
    </form>;
}

