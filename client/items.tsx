/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { cell, Context, createElement, For, Fragment, Show } from "cytoplasmic";
import { openDialog } from "./dialog";
import { Item } from "./dto";
import { GameService, GameServiceContext } from "./services/game-service";
import { applyFilter, dataSource, DerefData, getItemName, Select } from "./util";
import { AddProject } from "./workshop";

type ItemFilter = {
    name: string,
    apply: (item: Item) => boolean,
};

const filters: ItemFilter[] = [
    {
        name: 'No Filter',
        apply: () => true,
    },
    {
        name: 'Weapons',
        apply: item => item.itemType.weapon,
    },
    {
        name: 'Seeds',
        apply: item => item.itemType.seed,
    },
    {
        name: 'Food',
        apply: item => item.itemType.food,
    },
    {
        name: 'Reactor Fuel',
        apply: item => item.itemType.reactivity > 0,
    },
];

export function Items({}: {}, context: Context) {
    const gameService = context.use(GameServiceContext);

    const items = dataSource(() => gameService.getItems());
    const activeFilter = cell<ItemFilter>(filters[0]);

    function show(item: Item) {
        openDialog(ShowItem, {item, gameService});
    }

    async function filter() {
        const selection: ItemFilter|undefined = await openDialog(Select, {
            selection: activeFilter.value,
            options: filters,
            toString: (filter: ItemFilter) => filter.name,
        });
        if (selection) {
            activeFilter.value = selection;
        }
    }

    async function craft() {
        if (await openDialog(AddProject, {gameService})) {
            items.refresh();
            gameService.refreshBunker();
        }
    }

    context.onDestroy(gameService.bunker.observe(() => items.refresh()));
    context.onDestroy(gameService.expeditionDone.observe(() => items.refresh()));

    return <>
        <div class='stack-row justify-end spacing margin-bottom'>
            <button onClick={filter}>Filter</button>
            <button onClick={craft}>Craft</button>
        </div>
        <DerefData data={items}>{items =>
            <>
                <div role='grid' class='stack-column'>
                    <For each={applyFilter(items, activeFilter)}>{item =>
                        <button role='row' onClick={() => show(item.value)}>
                            <div role='gridcell' class='stack-row spacing'>
                                <div>{item.map(getItemName)}</div>
                            </div>
                        </button>
                        }</For>
                </div>
                <Show when={items.map(p => !p.length)}>
                    <div>No items</div>
                </Show>
            </>
            }</DerefData>
    </>;
}

function ShowItem({item, gameService}: {
    item: Item,
    gameService: GameService,
}) {
    const ammoType = cell('');
    if (item.itemType.ammoType) {
        gameService.getItemTypeName(item.itemType.ammoType).then(name => ammoType.value = name);
    }
    return <div class='stack-column spacing padding'>
        <strong>
            {item.itemType.name}
        </strong>
        <Show when={cell(item.itemType.weapon)}>
            <div>Weapon</div>
            <div class='stack-row spacing justify-space-between'>
                <strong>Range</strong>
                <div>{item.itemType.range}</div>
            </div>
            <div class='stack-row spacing justify-space-between'>
                <strong>Damage</strong>
                <div>{item.itemType.damage}</div>
            </div>
            <Show when={ammoType}>
                <div class='stack-row spacing justify-space-between'>
                    <strong>Ammo</strong>
                    <div>{ammoType}</div>
                </div>
            </Show>
        </Show>
        <Show when={cell(item.itemType.reactivity)}>
            <div>Reactor Fuel</div>
            <div class='stack-row spacing justify-space-between'>
                <strong>Reactivity</strong>
                <div>{item.itemType.reactivity}</div>
            </div>
        </Show>
        <Show when={cell(item.itemType.seed)}>
            <div>Seed</div>
            <div class='stack-row spacing justify-space-between'>
                <strong>Growth Time</strong>
                <div>{item.itemType.growthTime} days</div>
            </div>
        </Show>
        <Show when={cell(item.itemType.food)}>
            <div>Food</div>
        </Show>
    </div>;
}
