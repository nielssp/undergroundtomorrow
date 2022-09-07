/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { bind, createElement, Deref, Fragment, For, Show, Property, TextControl, IntControl, Field, zipWith } from "cstk";
import { ChangePassword } from "./change-password";
import { openConfirm, openDialog, openPrompt } from "./dialog";
import { NewWorld, User, World } from "./dto";
import { handleError } from "./error";
import { Register } from "./register";
import { AuthService } from "./services/auth-service";
import { GameService } from "./services/game-service";
import { LobbyService } from "./services/lobby-service";
import { dataSource, DerefData } from "./util";

export function Lobby({user, authService, lobbyService, gameService}: {
    user: Property<User>,
    authService: AuthService,
    lobbyService: LobbyService,
    gameService: GameService,
}) {
    const worlds = dataSource(() => lobbyService.getWorlds());

    function reload() {
        worlds.refresh();
    }

    async function createWorld() {
        const world = await openDialog(CreateWorld, {});
        if (world) {
            await lobbyService.createWorld(world);
            reload();
        }
    }

    async function enterWorld(world: World) {
        try {
            if (world.joined) {
                await gameService.selectWorld(world.id);
            } else {
                if (await openConfirm(`You don't have a bunker in "${world.name}", would you like to create one?`, [
                    {
                        text: 'No',
                        role: false,
                    },
                    {
                        text: 'Yes',
                        role: true,
                    },
                ])) {
                    await lobbyService.joinWorld(world.id);
                    await gameService.selectWorld(world.id);
                }
            }
        } catch (error) {
            handleError(error)
        }
    }

    async function finishRegistration() {
        await openDialog(Register, {authService});
    }

    async function changePassword() {
        await openDialog(ChangePassword, {authService});
    }

    return <div class='padding spacing stack-column grow'>
        <div class='stack-row spacing justify-space-between align-center'>
            <div>Welcome, {user.props.username}</div>
            <div class='stack-row spacing'>
                <Show when={user.props.admin}>
                    <button onClick={createWorld}>Create World</button>
                </Show>
                <button onClick={() => authService.invalidate()}>Log Out</button>
            </div>
        </div>
        <strong>Select World:</strong>
        <DerefData data={worlds}>{worlds =>
            <>
                <div role='grid' class='stack-column grow'>
                    <For each={worlds}>{world =>
                        <button role='row' class='stack-row spacing' onClick={() => enterWorld(world.value)}>
                            <div role='gridcell' class='grow'>{world.props.name}</div>
                            <div role='gridcell'>{world.props.players} players</div>
                        </button>
                        }</For>
                </div>
                <Show when={worlds.map(w => !w.length)}>
                    <div>No worlds</div>
                </Show>
            </>
            }</DerefData>
        <Show when={user.props.guest}>
            <div>You're currenly logged in as a guest. To complete your registration and save your progress, use the button below:</div>
            <div>
                <button onClick={finishRegistration}>Complete Registration</button>
            </div>
        </Show>
        <Show when={user.props.guest.not}>
            <div class='stack-row margin-top'>
                <button onClick={changePassword}>Change Password</button>
            </div>
        </Show>
    </div>;
}

function CreateWorld({close}: {
    close: (world: NewWorld) => void,
}) {
    const name = new TextControl('');
    const year = new IntControl(2072);
    const acceleration = new IntControl(1);
    acceleration.min = 1;
    const timeZone = new IntControl(-5);
    const invalid = zipWith([name, acceleration], (n, a) => !n || !a);

    function submit(e: Event) {
        e.preventDefault();
        close({
            name: name.value,
            open: true,
            startYear: year.value,
            timeAcceleration: acceleration.value,
            timeOffset: 3600 * timeZone.value,
        });
    }

    return <form class='padding stack-column spacing' onSubmit={submit}>
        <div class='stack-row spacing justify-space-between'>
            <Field control={name}>
                <label>Name</label>
                <input type='text'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={year}>
                <label>Year</label>
                <input type='number'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={acceleration}>
                <label>Acceleration</label>
                <input type='number'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={timeZone}>
                <label>Time Zone</label>
                <input type='number'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-end'>
            <button type='submit' disabled={invalid}>Create</button>
        </div>
    </form>;
}
