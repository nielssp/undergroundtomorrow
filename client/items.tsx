import {bind, createElement, Deref, For, Fragment, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import {GameService} from "./services/game-service";
import {LoadingIndicator} from "./util";

export function Items({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const error = bind(false);
    const promise = bind(gameService.getItems());
    const items = promise.await(() => error.value = true);
    return <>
        <LoadingIndicator loading={items.not.and(error.not)}/>
        <Show when={error}>
            <div>ERROR</div>
        </Show>
        <Deref ref={items}>{items =>
            <>
                <div class='stack-column spacing'>
                    <For each={items}>{item =>
                        <div class='stack-row spacing'>
                            <div>{item.props.itemType}</div>
                            <Show when={item.props.quantity.map(q => q > 1)}>
                                <div>({item.props.quantity})</div>
                            </Show>
                        </div>
                        }</For>
                </div>
                <Show when={items.map(p => !p.length)}>
                    <div>No items</div>
                </Show>
            </>
            }</Deref>
    </>;
}
