import { bind, createElement, Deref, mount, Show, Fragment } from 'cstk';
import { Api } from './api';
import { environment } from './config/environment';
import { Icon } from './icon';
import { Login } from './login';
import './main.scss';
import { Register } from './register';
import { AuthService } from './services/auth-service';

function Root({authService}: {
    authService: AuthService,
}, context: JSX.Context) {
    const loading = bind(true);
    const register = bind(false);
    const amber = bind(localStorage.getItem('utTheme') === 'amber');

    async function authenticate() {
        loading.value = true;
        try {
            if (await authService.getUser()) {
            }
        } catch (error) {
        } finally {
            loading.value = false;
        }
    }

    authenticate();

    context.onDestroy(amber.getAndObserve(amber => {
        localStorage.setItem('utTheme', amber ? 'amber' : 'green');
        if (amber) {
            document.body.classList.add('amber')
        } else {
            document.body.classList.remove('amber')
        }
    }));

    return <div class='bezel'>
        <div class='display'>
            <Show when={loading}>
                <div>Please wait...</div>
            </Show>
            <Show when={loading.not}>
                <Show when={authService.user.not}>
                    <div>
                        <Icon name='logo'/>
                    </div>
                    <div style='font-weight: bold;'>Underground Tomorrow</div>
                    <div>Bunker Administration Operating System</div>
                    <div>Version 2.0</div>
                    <br/>
                    <Show when={register.not}>
                        <Login authService={authService}/>
                        <br/>
                        <button onClick={() => register.value = true}>Register</button>
                    </Show>
                    <Show when={register}>
                        <Register authService={authService} onClose={() => register.value = false}/>
                    </Show>
                </Show>
                <Deref ref={authService.user}>{user =>
                    <>
                        <div>Welcome back, {user.props.username}.</div>
                        <div>
                            <button onClick={() => authService.invalidate()}>Log Out</button>
                        </div>
                    </>
                }</Deref>
            </Show>
            <br/>
            <br/>
            <div>
                <button onClick={() => amber.value = !amber.value}>Amber</button>
            </div>
        </div>
    </div>;
}

const api = new Api(environment.apiUrl);
const authService = new AuthService(api);

mount(document.body, <Root authService={authService}/>)
