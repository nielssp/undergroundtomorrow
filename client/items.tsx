import {ariaBool, bind, createElement, Deref, For, Fragment, Property, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Item } from "./dto";
import {GameService} from "./services/game-service";
import {applyFilter, dataSource, DerefData, getItemName, LoadingIndicator, Select} from "./util";
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

export function Items({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const items = dataSource(() => gameService.getItems());
    const activeFilter = bind<ItemFilter>(filters[0]);

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
    const ammoType = bind('');
    if (item.itemType.ammoType) {
        gameService.getItemTypeName(item.itemType.ammoType).then(name => ammoType.value = name);
    }
    return <div class='stack-column spacing padding'>
        <strong>
            {item.itemType.name}
        </strong>
        <Show when={bind(item.itemType.weapon)}>
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
        <Show when={bind(item.itemType.reactivity)}>
            <div>Reactor Fuel</div>
            <div class='stack-row spacing justify-space-between'>
                <strong>Reactivity</strong>
                <div>{item.itemType.reactivity}</div>
            </div>
        </Show>
        <Show when={bind(item.itemType.seed)}>
            <div>Seed</div>
            <div class='stack-row spacing justify-space-between'>
                <strong>Growth Time</strong>
                <div>{item.itemType.growthTime} days</div>
            </div>
        </Show>
        <Show when={bind(item.itemType.food)}>
            <div>Food</div>
        </Show>
    </div>;
}
