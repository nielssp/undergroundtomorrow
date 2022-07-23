import { bind, createElement, Deref, mount, Show, Fragment, ref, ariaBool } from 'cstk';
import { Api } from './api';
import { environment } from './config/environment';
import { Icon } from './icon';
import { Login } from './login';
import './main.scss';
import { Map } from './map';
import { Register } from './register';
import { AuthService } from './services/auth-service';

function Root({authService}: {
    authService: AuthService,
}, context: JSX.Context) {
    const loading = bind(true);
    const register = bind(false);
    const amber = bind(localStorage.getItem('utTheme') === 'amber');

    const tab = bind<'status'|'people'|'items'|'map'|'radio'|'messages'>('status');

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
            document.documentElement.classList.add('amber')
        } else {
            document.documentElement.classList.remove('amber')
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
                        <br/>
                        <button>Guest</button>
                    </Show>
                    <Show when={register}>
                        <Register authService={authService} onClose={() => register.value = false}/>
                    </Show>
                </Show>
                <Deref ref={authService.user}>{user =>
                    <>
                        <menu role='tablist'>
                            <li><button onClick={() => tab.value = 'status'} aria-selected={ariaBool(tab.eq('status'))}>Status</button></li>
                            <li><button onClick={() => tab.value = 'people'} aria-selected={ariaBool(tab.eq('people'))}>People</button></li>
                            <li><button onClick={() => tab.value = 'items'} aria-selected={ariaBool(tab.eq('items'))}>Items</button></li>
                            <li><button onClick={() => tab.value = 'map'} aria-selected={ariaBool(tab.eq('map'))}>Map</button></li>
                            <li><button onClick={() => tab.value = 'radio'} aria-selected={ariaBool(tab.eq('radio'))}>Radio</button></li>
                            <li><button onClick={() => tab.value = 'messages'} aria-selected={ariaBool(tab.eq('messages'))} class='attention'><Icon name='message'/></button></li>
                        </menu>
                        <Show when={tab.eq('status')}>
                            <div>Welcome back, {user.props.username}.</div>
                            <div>
                                <button onClick={() => authService.invalidate()}>Log Out</button>
                            </div>
                        </Show>
                        <Show when={tab.eq('map')}>
                            <Map/>
                        </Show>
                    </>
                }</Deref>
            </Show>
            <div class='status-bar' style='margin-top: auto;'>
                <div class='status'>01/01/2070</div>
                <div class='status'>08:56 AM</div>
                <div class='status' style='flex-grow: 1;'>Bunker 101</div>
                <button onClick={() => amber.value = !amber.value}>Mode</button>
            </div>
        </div>
    </div>;
}

const api = new Api(environment.apiUrl);
const authService = new AuthService(api);

mount(document.body, <Root authService={authService}/>)
