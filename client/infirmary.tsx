/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { cell, createElement, Fragment, Cell, Show } from "cytoplasmic";
import { openDialog } from "./dialog";
import { InfirmaryStatus } from "./dto";
import { handleError } from "./error";
import { Restock } from "./restock";
import { GameService } from "./services/game-service";

export function Infirmary({gameService, status, onReload}: {
    gameService: GameService,
    status: Cell<InfirmaryStatus>,
    onReload: () => void,
}) {

    async function inventory() {
        const newValue = await openDialog(Restock, {gameService, current: status.value.medicine, itemType: 'medicine'})
        if (newValue != undefined) {
            try {
                await gameService.updateInfirmaryInventory(newValue);
                onReload();
            } catch (error) {
                handleError(error);
            }
        }
    }

    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Infirmary</strong>
        </div>
        <div class='stack-row spacing align-center'>
            <Show when={status.props.medicine.not}><div>NO MEDICINE</div></Show>
            <Show when={status.props.medicine}><div>Medicine: {status.props.medicine}</div></Show>
            <button style='margin-left: auto;' onClick={inventory}>Inventory</button>
        </div>
    </div>;
}
