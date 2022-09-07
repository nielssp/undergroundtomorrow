/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { bind, createElement, Deref, Fragment, Property, Show } from "cstk";
import { Cafeteria } from "./cafeteria";
import { AirRecyclingStatus, User, WaterTreatmentStatus } from "./dto";
import { Horticulture } from "./horticulture";
import { Infirmary } from "./infirmary";
import { Reactor } from "./reactor";
import { AuthService } from "./services/auth-service";
import { GameService } from "./services/game-service";
import { Workshop } from "./workshop";

export function Status({gameService, user, authService}: {
    user: Property<User>
    gameService: GameService,
    authService: AuthService,
}, context: JSX.Context) {
    function refresh() {
        gameService.refreshBunker();
    }
    return <>
    <div class='stack-row spacing justify-space-between align-center'>
        <div>Welcome back, {user.props.username}.</div>
        <div class='stack-row spacing'>
            <button onClick={() => gameService.world.value = undefined}>Switch</button>
            <button onClick={() => authService.invalidate()}>Log Out</button>
        </div>
    </div>
    <div class='margin-top stack-column spacing'>
        <Deref ref={gameService.bunker}>{bunker =>
            <>
                <Reactor gameService={gameService} status={bunker.props.reactor} onReload={() => refresh()}/>
                <WaterTreatment gameService={gameService} status={bunker.props.waterTreatment} onReload={() => refresh()}/>
                <AirRecycling gameService={gameService} status={bunker.props.airRecycling} onReload={() => refresh()}/>
                <Horticulture gameService={gameService} status={bunker.props.horticulture} onReload={() => refresh()}/>
                <Infirmary gameService={gameService} status={bunker.props.infirmary} onReload={() => refresh()}/>
                <Workshop gameService={gameService} status={bunker.props.workshop} onReload={() => refresh()}/>
                <Cafeteria gameService={gameService} status={bunker.props.cafeteria} onReload={() => refresh()}/>
            </>
            }</Deref>
    </div>
</>;
}

export function WaterTreatment({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<WaterTreatmentStatus>,
    onReload: () => void,
}) {
    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Water Treatment</strong>
            <div>Maintenance {status.props.maintenance}%</div>
        </div>
        <div class='stack-row spacing align-center'>
            <Show when={status.props.malfunction}><div>MALFUNCTION</div></Show>
        </div>
    </div>;
}

export function AirRecycling({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<AirRecyclingStatus>,
    onReload: () => void,
}) {
    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Air Recycling</strong>
            <div>Maintenance {status.props.maintenance}%</div>
        </div>
        <div class='stack-row spacing align-center'>
            <Show when={status.props.malfunction}><div>MALFUNCTION</div></Show>
        </div>
    </div>;
}
