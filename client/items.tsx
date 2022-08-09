import {bind, createElement, Deref, For, Fragment, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Item } from "./dto";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, getItemName, LoadingIndicator} from "./util";

export function Items({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const items = dataSource(() => gameService.getItems());

    function show(item: Item) {
        openDialog(ShowItem, {item});
    }

    return <>
        <DerefData data={items}>{items =>
            <>
                <div role='grid' class='stack-column'>
                    <For each={items}>{item =>
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
    </div>;
}
