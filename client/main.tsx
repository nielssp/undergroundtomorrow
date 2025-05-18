/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { cell, createElement, Deref, mount, Show, Fragment, ref, Context, createRouter, Link } from 'cytoplasmic';
import { format } from 'date-fns';
import { dialogContainer, openDialog } from './dialog';
import { Icon } from './icon';
import { Lobby } from './lobby';
import { Login } from './login';
import './main.scss';
import { Register } from './register';
import { AuthServiceContext } from './services/auth-service';
import { GameServiceContext } from './services/game-service';
import { LoadingIndicator } from './util';
import { handleError } from './error';

function Root({}: {}, context: Context) {
    const authService = context.use(AuthServiceContext);
    const gameService = context.use(GameServiceContext);

    const loading = cell(true);
    const amber = cell(localStorage.getItem('utTheme') !== 'green');
    const displayRef = ref<HTMLDivElement>();

    const router = createRouter({
        '': () => <Deref ref={authService.user}>{user =>
                <div class='stack-column grow' style='overflow-y: auto;'>
                    <Lobby user={user}/>
                </div>
            }</Deref>,
        '*': worldId => ({
            '**': async () => {
                try {
                    loading.value = true;
                    const m = await import('./game');
                    await gameService.selectWorld(parseInt(worldId));
                    return <Deref ref={authService.user}>{user =>
                        <m.Game user={user} amber={amber}/>
                    }</Deref>;
                } catch (error: unknown) {
                    handleError(error);
                    router.navigate('/');
                    return <div class="stack-row spacing">
                        <div>
                            Error
                        </div>
                        <Link path=''>
                            <a>Return</a>
                        </Link>
                    </div>;
                } finally {
                    loading.value = false;
                }
            },
        }),
        '**': () => <div class="stack-row-spacing">
            <div>
                Not found
            </div>
            <Link path=''>
                <a>Return</a>
            </Link>
        </div>,
    }, 'hash');

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


    context.onDestroy(gameService.world.getAndObserve(world => {
        if (world) {
            const page = router.activeRoute.value?.path[1] || 'status';
            console.log(world.id, page);
            router.navigate([String(world.id), page]);
        } else {
            router.navigate([]);
        }
    }));

    async function guest() {
        try {
            await authService.guest(true);
        } catch (error: unknown) {
            handleError(error);
        }
    }

    async function register() {
        await openDialog(Register, {authService});
    }

    return <div class='bezel'>
        <div class='display' ref={displayRef}>
            <LoadingIndicator loading={loading}/>
            <Show when={loading.not}>
                <Show when={authService.user.not}>
                    <div class='stack-column spacing padding grow' style='overflow-y: auto;'>
                        <div>
                            <Icon name='logo'/>
                        </div>
                        <div style='font-weight: bold;'>Underground Tomorrow</div>
                        <div><a href="https://undergroundtomorrow.com">About</a></div>
                        <div>To become the administrator of an Underground Tomorrow bunker, use one of the buttons below:</div>
                        <div class='stack-row spacing'>
                            <button onClick={guest}>Play As Guest</button>
                            <button onClick={register}>Register</button>
                        </div>
                        <div>If you're already the administrator of a bunker, log in using your credentials below:</div>
                        <Login authService={authService}/>
                    </div>
                </Show>
                <Show when={authService.user}>
                    <router.Portal/>
                </Show>
            </Show>
            <div class='status-bar margin-top'>
                <Deref ref={gameService.bunker}>{bunker =>
                    <>
                        <div class='status'>{gameService.worldTime.map(wt => format(wt, 'MM/dd/yyyy'))}</div>
                        <div class='status'>{gameService.worldTime.map(wt => format(wt, 'hh:mm a'))}</div>
                        <div class='status' style='flex-grow: 1;'>Bunker {bunker.props.number}</div>
                    </>
                    }</Deref>
                <Show when={gameService.bunker.not}>
                    <div class='status' style='flex-grow: 1;'>Underground Tomorrow</div>
                </Show>
                <button onClick={() => amber.value = !amber.value}>Mode</button>
            </div>
        </div>
    </div>;
}

mount(document.body, <Root/>)
