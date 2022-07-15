import { bind, createElement, Field, TextControl } from "cstk";
import { openAlert } from "./dialog";
import { handleError } from "./error";
import { AuthService } from "./services/auth-service";

export function Register({authService, onClose}: {
    authService: AuthService,
    onClose: () => void,
}) {
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
            openAlert('Register', 'Password mismatch');
            return;
        }
        loading.value = true;
        try {
            await authService.register({username, password});
            await authService.authenticate({username, password});
            onClose();
        } catch (error: any) {
            switch (error?.code) {
                case 'USERNAME_TAKEN':
                    openAlert('Register', 'The name is not available');
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
        <div class='margin-bottom'>
            <Field control={confirmPasswordControl}>
                <label>Confirm Password:</label>
                <input type='password' disabled={loading}/>
            </Field>
        </div>
        <div>
            <button type='button' onClick={onClose} disabled={loading}>Cancel</button>
            <button type='submit' disabled={loading}>Register</button>
        </div>
    </form>;
}
