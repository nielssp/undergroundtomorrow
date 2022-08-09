import {bind, createElement, Fragment, Property, Show} from "cstk";
import { openDialog } from "./dialog";
import { InfirmaryStatus } from "./dto";
import { handleError } from "./error";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, QuantityButtons} from "./util";

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

function UpdateInfirmary({gameService, status, close}: {
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

