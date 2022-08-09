import { bind, Fragment, createElement, For, Property, ref, Show, ariaBool } from "cstk";
import { openConfirm, openDialog } from "./dialog";
import { Crop, HorticultureStatus, Item } from "./dto";
import { handleError } from "./error";
import { GameService } from "./services/game-service";
import { dataSource, DerefData, getItemName, QuantityButtons } from "./util";

export function Horticulture({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<HorticultureStatus>,
    onReload: () => void,
}) {

    function manage() {
        openDialog(ManageCrops, {gameService, status, onReload});
    }

    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Horticulture</strong>
        </div>
        <div class='stack-row spacing align-center'>
            <div>Crops: {status.map(s => s.crops.length)}</div>
            <button style='margin-left: auto;' onClick={manage}>Manage</button>
        </div>
    </div>;
}

function ManageCrops({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<HorticultureStatus>,
    onReload: () => void,
}) {

    async function add() {
        if (await openDialog(AddCrop, {gameService})) {
            onReload();
        }
    }

    async function remove(crop: Crop, index: number) {
        if (await openConfirm(`Remove ${crop.name}?`)) {
            try {
                await gameService.removeCrop(index);
                onReload();
            } catch (error) {
                handleError(error);
            }
        }
    }

    return <div class='stack-column spacing padding'>
        <For each={status.props.crops}>{(crop, index) => 
            <div class='stack-column'>
                <div class='stack-row spacing justify-space-between'>
                    <strong>{crop.props.name} ({crop.props.quantity})</strong>
                    <div>{crop.map(c => Math.floor(c.stage / c.max * 100))}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>
                        <Show when={crop.props.stunted}><div>STUNTED</div></Show>
                    </div>
                    <button onClick={() => remove(crop.value, index.value)}>Remove</button>
                </div>
            </div>
        }</For>
        <Show when={status.map(s => !s.crops.length)}>
            <div>No crops</div>
        </Show>
        <div class='stack-row spacing justify-end'>
            <button disabled={status.map(s => s.crops.length >= 6)} onClick={add}>Add</button>
        </div>
    </div>;
}

function AddCrop({gameService, close}: {
    gameService: GameService,
    close: (reload: true) => void,
}) {
    const seedType = ref<string>();
    const amount = bind(0);
    const max = bind(0);
    const seeds = dataSource(() => gameService.getItems().then(items => items.filter(item => item.itemType.seed)));

    async function ok() {
        try {
            if (!seedType.value) {
                return;
            }
            await gameService.addCrop(seedType.value, amount.value);
            close(true);
        } catch (error) {
            handleError(error);
        }
    }

    function select(seed: Item) {
        seedType.value = seed.itemType.id;
        max.value = seed.quantity;
        if (amount.value > max.value || amount.value === 0) {
            amount.value = max.value;
        }
    }

    return <div class='stack-column spacing padding'>
        <DerefData data={seeds}>{ seeds => 
            <>
                <div role='grid' class='stack-column'>
                    <For each={seeds}>{seed =>
                        <button role='row' class='selectable' onClick={() => select(seed.value)} aria-selected={ariaBool(seed.props.itemType.props.id.eq(seedType))}>
                            <div role='gridcell' class='stack-row spacing'>
                                <div>{seed.map(getItemName)}</div>
                                <Show when={seed.props.quantity.map(q => q !== 1)}>
                                    <div>({seed.props.quantity})</div>
                                </Show>
                            </div>
                        </button>
                        }</For>
                </div>
                <Show when={seeds.map(s => !s.length)}>
                    <div>No seeds available</div>
                </Show>
                <div class='stack-row spacing justify-space-between'>
                    <div>Quantity:</div>
                    <div>{amount} / {max}</div>
                </div>
                <QuantityButtons value={amount} max={max}/>
                <div class='stack-row spacing justify-end'>
                    <button disabled={seedType.undefined.or(amount.map(a => a < 1))} onClick={ok}>Plant</button>
                </div>
            </>
        }</DerefData>
    </div>;
}
