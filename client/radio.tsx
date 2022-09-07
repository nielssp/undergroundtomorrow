/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createElement, Field, For, Fragment, ref, TextControl } from "cstk";
import { handleError } from "./error";
import { GameService } from "./services/game-service";
import { LoadingIndicator } from "./util";

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
        <LoadingIndicator loading={gameService.radioConnected.not}/>
        <div ref={logElem} class='grow' style='overflow: auto;'>
            <For each={gameService.transcript}>{broadcast =>
                <div class='stack-row spacing'>
                    <strong>
                        [{broadcast.props.name}@bunker{broadcast.props.bunker}]
                    </strong>
                    <div style='word-wrap: anywhere;'>
                        {broadcast.props.message}
                    </div>
                </div>
            }</For>
        </div>
        <form class='stack-row spacing margin-top' onSubmit={submit}>
            <Field control={message}>
                <input type='text' class='grow' maxLength={200}/>
            </Field>
            <button type='submit' disabled={message.not.or(gameService.radioConnected.not)}>Broadcast</button>
        </form>
    </>;
}

