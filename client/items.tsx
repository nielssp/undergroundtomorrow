import {ariaBool, bind, createElement, Deref, For, Fragment, Property, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Item } from "./dto";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, getItemName, LoadingIndicator} from "./util";
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

function applyFilter<T>(list: Property<T[]>, filter: Property<{apply: (item: T) => boolean}>): Property<T[]> {
    return zipWith([list, filter], (l, f) => {
        return l.filter(f.apply);
    });
}

export function Items({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const items = dataSource(() => gameService.getItems());
    const activeFilter = bind<ItemFilter>(filters[0]);

    function show(item: Item) {
        openDialog(ShowItem, {item});
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
        }
    }

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

function Select<T>({selection, options, toString, close}: {
    selection: T,
    options: T[],
    toString: (option: T) => string,
    close: (selection: T) => void,
}) {
    return <div class='stack-column padding'>
        <div role='grid' class='stack-column'>
            <For each={bind(options)}>{item =>
                <button role='row' class='selectable' aria-selected={ariaBool(item.eq(selection))} onClick={() => close(item.value)}>
                    <div role='gridcell' class='stack-row spacing'>
                        <div>{item.map(toString)}</div>
                    </div>
                </button>
                }</For>
        </div>
    </div>;
}

function ShowItem({item}: {
    item: Item,
}) {
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
