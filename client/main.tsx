import { bind, createElement, Deref, mount, Show, Fragment, ref, ariaBool } from 'cstk';
import {format} from 'date-fns';
import { Api } from './api';
import { environment } from './config/environment';
import { dialogContainer } from './dialog';
import { Icon } from './icon';
import {Items} from './items';
import {Lobby} from './lobby';
import { Login } from './login';
import './main.scss';
import { Map } from './map';
import {Messages} from './messages';
import {People} from './people';
import { Register } from './register';
import { AuthService } from './services/auth-service';
import {GameService} from './services/game-service';
import {LobbyService} from './services/lobby-service';
import { Status } from './status';
import {LoadingIndicator} from './util';

function Root({authService, lobbyService, gameService}: {
    authService: AuthService,
    lobbyService: LobbyService,
    gameService: GameService,
}, context: JSX.Context) {
    const loading = bind(true);
    const register = bind(false);
    const amber = bind(localStorage.getItem('utTheme') === 'amber');
    const displayRef = ref<HTMLDivElement>();

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

    context.onInit(() => {
        if (displayRef.value) {
            dialogContainer.value = displayRef.value;
        }
    });

    context.onDestroy(amber.getAndObserve(amber => {
        localStorage.setItem('utTheme', amber ? 'amber' : 'green');
        if (amber) {
            document.documentElement.classList.add('amber')
        } else {
            document.documentElement.classList.remove('amber')
        }
    }));

    context.onDestroy(authService.user.getAndObserve(user => {
        if (user) {
            const m = location.hash.match(/^#(\d+)\/([^\/]+)$/);
            if (m) {
                tab.value = m[2] as any;
                gameService.selectWorld(parseInt(m[1]));
            }
        }
    }));

    context.onDestroy(gameService.world.getAndObserve(world => {
        if (world) {
            location.hash = `${world.id}/${tab.value}`;
        }
    }));

    context.onDestroy(tab.getAndObserve(tab => {
        const worldId = gameService.world.value?.id;
        if (worldId) {
            location.hash = `${worldId}/${tab}`;
        }
    }));

    return <div class='bezel'>
        <div class='display' ref={displayRef}>
            <LoadingIndicator loading={loading}/>
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
                        <Show when={gameService.world.not}>
                            <div class='stack-column grow' style='overflow-y: auto;'>
                                <Lobby user={user} authService={authService} lobbyService={lobbyService} gameService={gameService}/>
                            </div>
                        </Show>
                        <Show when={gameService.world}>
                            <menu role='tablist'>
                                <li><button onClick={() => tab.value = 'status'} aria-selected={ariaBool(tab.eq('status'))}>Status</button></li>
                                <li><button onClick={() => tab.value = 'people'} aria-selected={ariaBool(tab.eq('people'))}>People</button></li>
                                <li><button onClick={() => tab.value = 'items'} aria-selected={ariaBool(tab.eq('items'))}>Items</button></li>
                                <li><button onClick={() => tab.value = 'map'} aria-selected={ariaBool(tab.eq('map'))}>Map</button></li>
                                <li><button onClick={() => tab.value = 'radio'} aria-selected={ariaBool(tab.eq('radio'))}>Radio</button></li>
                                <li><button onClick={() => tab.value = 'messages'} aria-selected={ariaBool(tab.eq('messages'))} class={{attention: gameService.messageNotification}}><Icon name='message'/></button></li>
                            </menu>
                            <div class='stack-column grow' style='overflow-y: auto;'>
                                <Show when={tab.eq('status')}>
                                    <Status gameService={gameService} authService={authService} user={user}/>
                                </Show>
                                <Show when={tab.eq('people')}>
                                    <People gameService={gameService}/>
                                </Show>
                                <Show when={tab.eq('items')}>
                                    <Items gameService={gameService}/>
                                </Show>
                                <Show when={tab.eq('map')}>
                                    <Map amber={amber} gameService={gameService}/>
                                </Show>
                                <Show when={tab.eq('messages')}>
                                    <Messages gameService={gameService}/>
                                </Show>
                            </div>
                        </Show>
                    </>
                    }</Deref>
            </Show>
            <div class='status-bar margin-top'>
                <Deref ref={gameService.bunker}>{bunker =>
                    <>
                        <div class='status'>{gameService.worldTime.map(wt => format(wt, 'MM/dd/yyyy'))}</div>
                        <div class='status'>{gameService.worldTime.map(wt => format(wt, 'hh:mm a'))}</div>
                        <div class='status' style='flex-grow: 1;'>Bunker {bunker.props.number}</div>
                    </>
                    }</Deref>
                <button onClick={() => amber.value = !amber.value}>Mode</button>
            </div>
        </div>
    </div>;
}

const api = new Api(environment.apiUrl);
const authService = new AuthService(api);
const lobbyService = new LobbyService(api);
const gameService = new GameService(api);

mount(document.body, <Root authService={authService} lobbyService={lobbyService} gameService={gameService}/>)
