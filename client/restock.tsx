import {bind, createElement, Fragment} from "cstk";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, QuantityButtons} from "./util";

export function Restock({gameService, current, itemType, close}: {
    gameService: GameService,
    current: number,
    itemType: string,
    close: (newValue: number) => void,
}) {
    const assigned = bind(current);
    const itemTypeName = bind(gameService.getItemTypeName(itemType, 2)).await().orElse('');
    const item = dataSource(() => gameService.getItems().then(items => items.find(item => item.itemType.id === itemType)?.quantity || 0));
    const total = item.data.orElse(0).map(x => x + current);

    async function ok() {
        close(assigned.value);
    }

    return <div class='stack-column spacing padding'>
        <DerefData data={item}>{ () => 
            <>
                <div class='stack-row spacing justify-space-between'>
                    <div>{itemTypeName}:</div>
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

