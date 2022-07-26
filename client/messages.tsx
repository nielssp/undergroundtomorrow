import {bind, createElement, Deref, For, Fragment, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import {GameService} from "./services/game-service";
import {LoadingIndicator} from "./util";

export function Messages({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const error = bind(false);
    const promise = bind(gameService.getMessages());
    const messages = promise.await(() => error.value = true);
    return <>
        <div class='stack-row spacing margin-bottom justify-end'>
            <button>New</button>
        </div>
        <LoadingIndicator loading={messages.not.and(error.not)}/>
        <Show when={error}>
            <div>ERROR</div>
        </Show>
        <Deref ref={messages}>{messages =>
            <>
                <div class='stack-column spacing'>
                    <For each={messages}>{message =>
                        <div class='stack-row spacing'>
                            <div class='grow'>{message.props.subject}</div>
                            <div>{message.props.created.map(d => format(parseISO(d), 'MM/dd/yyyy hh:mm a'))}</div>
                        </div>
                        }</For>
                </div>
                <Show when={messages.map(p => !p.length)}>
                    <div>No messages</div>
                </Show>
            </>
            }</Deref>
    </>;
}
