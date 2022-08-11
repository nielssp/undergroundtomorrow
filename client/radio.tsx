import {ariaBool, bind, createElement, Deref, Field, For, Fragment, Property, ref, Show, TextControl, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Item } from "./dto";
import { handleError } from "./error";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, getItemName, LoadingIndicator} from "./util";
import { AddProject } from "./workshop";

export function Radio({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const logElem = ref<HTMLDivElement>();
    const message = new TextControl('');

    async function submit(event: Event) {
        event.preventDefault();
        if (!message.value) {
            return;
        }
        try {
            await gameService.broadcast(message.value);
            message.value = '';
        } catch (error) {
            handleError(error);
        }
    }

    const scrollToBottom = () => {
        // hm...
        setTimeout(() => {
            if (logElem.value) {
                logElem.value.scrollTop = logElem.value.scrollHeight;
            }
        }, 0);
    }
    context.onInit(() => {
        scrollToBottom();
    });

    context.onDestroy(gameService.transcript.onInsert.observe(() => scrollToBottom()));

    return <>
        <div ref={logElem} class='grow' style='overflow: auto;'>
            <LoadingIndicator loading={gameService.radioConnected.not}/>
            <For each={gameService.transcript}>{broadcast =>
                <div class='stack-row spacing'>
                    <strong>
                        [{broadcast.props.name}@bunker{broadcast.props.bunker}]
                    </strong>
                    <div>
                        {broadcast.props.message}
                    </div>
                </div>
            }</For>
        </div>
        <form class='stack-row spacing margin-bottom' onSubmit={submit}>
            <Field control={message}>
                <input type='text' class='grow'/>
            </Field>
            <button type='submit'>Broadcast</button>
        </form>
    </>;
}

