import {ariaBool, bind, createElement, Deref, For, Fragment, Property, ref, Show, ValueProperty, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openConfirm, openDialog } from "./dialog";
import { AirRecyclingStatus, Crop, HorticultureStatus, InfirmaryStatus, Item, ReactorStatus, User, WaterTreatmentStatus, WorkshopProject, WorkshopStatus } from "./dto";
import { handleError } from "./error";
import { AuthService } from "./services/auth-service";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, getItemName, LoadingIndicator} from "./util";

export function Status({gameService, user, authService}: {
    user: Property<User>
    gameService: GameService,
    authService: AuthService,
}, context: JSX.Context) {
    const bunkerData = dataSource(() => gameService.getBunker());
    return <>
    <div class='stack-row spacing justify-space-between align-center'>
        <div>Welcome back, {user.props.username}.</div>
        <div class='stack-row spacing'>
            <button onClick={() => gameService.world.value = undefined}>Switch</button>
            <button onClick={() => authService.invalidate()}>Log Out</button>
        </div>
    </div>
    <div class='margin-top stack-column spacing'>
        <DerefData data={bunkerData}>{bunker =>
            <>
                <Reactor gameService={gameService} status={bunker.props.reactor} onReload={() => bunkerData.refresh()}/>
                <WaterTreatment gameService={gameService} status={bunker.props.waterTreatment} onReload={() => bunkerData.refresh()}/>
                <AirRecycling gameService={gameService} status={bunker.props.airRecycling} onReload={() => bunkerData.refresh()}/>
                <Horticulture gameService={gameService} status={bunker.props.horticulture} onReload={() => bunkerData.refresh()}/>
                <Infirmary gameService={gameService} status={bunker.props.infirmary} onReload={() => bunkerData.refresh()}/>
                <Workshop gameService={gameService} status={bunker.props.workshop} onReload={() => bunkerData.refresh()}/>
            </>
            }</DerefData>
    </div>
</>;
}

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

export function SelectFuel({gameService, close}: {
    gameService: GameService,
    close: (itemType: string) => void,
}) {
    const items = dataSource(() => gameService.getItems().then(items => items.filter(item => item.itemType.reactivity > 0)));
    return <div class='stack-column padding'>
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

export function Infirmary({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<InfirmaryStatus>,
    onReload: () => void,
}) {

    async function inventory() {
        if (await openDialog(UpdateInfirmary, {gameService, status: status.value})) {
            onReload();
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

export function UpdateInfirmary({gameService, status, close}: {
    gameService: GameService,
    status: InfirmaryStatus,
    close: (reload: true) => void,
}) {
    const assigned = bind(status.medicine);
    const medicine = dataSource(() => gameService.getItems().then(items => items.find(item => item.itemType.id === 'medicine')?.quantity || 0));
    const total = medicine.data.orElse(0).map(x => x + status.medicine);

    async function ok() {
        try {
            await gameService.updateInfirmaryInventory(assigned.value);
            close(true);
        } catch (error) {
            handleError(error);
        }
    }

    return <div class='stack-column spacing padding'>
        <DerefData data={medicine}>{ () => 
            <>
                <div class='stack-row spacing justify-space-between'>
                    <div>Medicine:</div>
                    <div>{assigned} / {total}</div>
                </div>
                <QuantityButtons value={assigned} max={total}/>
                <div class='stack-row spacing justify-end'>
                    <button onClick={ok}>OK</button>
                </div>
            </>
        }</DerefData>
    </div>;
}

export function QuantityButtons({value, max}: {
    value: ValueProperty<number>,
    max: Property<number>,
}) {
    return <div class='stack-row spacing justify-space-between'>
        <button disabled={value.map(a => a <= 0)} onClick={() => value.value = Math.max(0, value.value - 10)}>-10</button>
        <button disabled={value.map(a => a <= 0)} onClick={() => value.value--}>-1</button>
        <button disabled={zipWith([value, max], (v, m) => v >= m)} onClick={() => value.value++}>+1</button>
        <button disabled={zipWith([value, max], (v, m) => v >= m)} onClick={() => value.value = Math.min(max.value, value.value + 10)}>+10</button>
    </div>;
}

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

export function ManageCrops({gameService, status, onReload}: {
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

export function AddCrop({gameService, close}: {
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

export function Workshop({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<WorkshopStatus>,
    onReload: () => void,
}) {

    function manage() {
        openDialog(ManageProjects, {gameService, status, onReload});
    }

    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Workshop</strong>
        </div>
        <div class='stack-row spacing align-center'>
            <div>Projects: {status.map(s => s.projects.length)}</div>
            <button style='margin-left: auto;' onClick={manage}>Manage</button>
        </div>
    </div>;
}

export function ManageProjects({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<WorkshopStatus>,
    onReload: () => void,
}) {

    async function add() {
        if (await openDialog(AddCrop, {gameService})) {
            onReload();
        }
    }

    async function remove(project: WorkshopProject, index: number) {
        if (await openConfirm(`Cancel ${project.itemType}?`)) {
            try {
                await gameService.removeProject(index);
                onReload();
            } catch (error) {
                handleError(error);
            }
        }
    }

    return <div class='stack-column spacing padding'>
        <For each={status.props.projects}>{(project, index) => 
            <div class='stack-column'>
                <div class='stack-row spacing justify-space-between'>
                    <strong>{project.props.itemType} ({project.props.quantity})</strong>
                    <div>{project.map(c => Math.floor(c.progress / c.max * 100))}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>
                        <Show when={project.props.produced}><div>{project.props.produced} produced</div></Show>
                    </div>
                    <button onClick={() => remove(project.value, index.value)}>Cancel</button>
                </div>
            </div>
        }</For>
        <Show when={status.map(s => !s.projects.length)}>
            <div>No active projects</div>
        </Show>
        <div class='stack-row spacing justify-end'>
            <button onClick={add}>Add</button>
        </div>
    </div>;
}
