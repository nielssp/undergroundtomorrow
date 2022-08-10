import {createElement, Property, Show} from "cstk";
import { CafeteriaStatus } from "./dto";
import {GameService} from "./services/game-service";


export function Cafeteria({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<CafeteriaStatus>,
    onReload: () => void,
}) {
    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Cafeteria</strong>
        </div>
        <div class='stack-row spacing align-center'>
            <Show when={status.props.food}><div>Food: {status.props.food}</div></Show>
            <Show when={status.props.food.not}><div>NO FOOD</div></Show>
        </div>
    </div>;
}


