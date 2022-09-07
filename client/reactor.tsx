/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createElement, For, Fragment, Property, Show } from "cstk";
import { openDialog } from "./dialog";
import { ReactorStatus } from "./dto";
import { handleError } from "./error";
import { GameService } from "./services/game-service";
import { dataSource, DerefData, getItemName } from "./util";

export function Reactor({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<ReactorStatus>,
    onReload: () => void,
}) {

    async function refuel() {
        const fuelType = await openDialog(SelectFuel, {gameService});
        if (fuelType) {
            try {
                await gameService.refuelReactor(fuelType);
                onReload();
            } catch (error) {
                handleError(error);
            }
        }
    }

    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Reactor</strong>
            <div>Maintenance {status.props.maintenance}%</div>
        </div>
        <div class='stack-row spacing align-center'>
            <Show when={status.props.malfunction}><div>MALFUNCTION</div></Show>
            <Show when={status.props.fuel.not}><div>LOW FUEL</div></Show>
            <Show when={status.props.fuel}><div>Fuel {status.props.fuel.map(f => f / 100)}%</div></Show>
            <button style='margin-left: auto;' onClick={refuel}>Refuel</button>
        </div>
    </div>;
}

function SelectFuel({gameService, close}: {
    gameService: GameService,
    close: (itemType: string) => void,
}) {
    const items = dataSource(() => gameService.getItems().then(items => items.filter(item => item.itemType.reactivity > 0)));
    return <div class='stack-column padding spacing'>
        <div>Select replacement fuel rod</div>
        <DerefData data={items}>{items =>
            <>
                <div role='grid' class='stack-column'>
                    <For each={items}>{item =>
                        <button role='row' onClick={() => close(item.value.itemType.id)}>
                            <div role='gridcell' class='stack-row spacing'>
                                <div>{item.map(getItemName)}</div>
                                <Show when={item.props.quantity.map(q => q !== 1)}>
                                    <div>({item.props.quantity})</div>
                                </Show>
                            </div>
                        </button>
                        }</For>
                </div>
                <Show when={items.map(p => !p.length)}>
                    <div>No fuel rods available</div>
                </Show>
            </>
            }</DerefData>
    </div>;
}

