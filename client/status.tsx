import {bind, createElement, Deref, For, Fragment, Property, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { AirRecyclingStatus, ReactorStatus, User, WaterTreatmentStatus } from "./dto";
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
                <div class='stack-row spacing justify-space-between'>
                    <div>Horticulture</div>
                    <div>{bunker.props.horticulture.props.condition}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>Infirmary</div>
                    <div>{bunker.props.infirmary.props.level}</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>Workshop</div>
                    <div>{bunker.props.workshop.props.level}</div>
                </div>
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
