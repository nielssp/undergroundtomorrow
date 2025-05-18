/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Context, createElement, For, Fragment, Show } from "cytoplasmic";
import { openDialog } from "./dialog";
import { Message } from "./dto";
import { handleError } from "./error";
import { GameServiceContext } from "./services/game-service";
import { dataSource, DerefData } from "./util";

export function Messages({}: {}, context: Context) {
    const gameService = context.use(GameServiceContext);

    const messages = dataSource(() => gameService.getMessages());

    gameService.messageNotification.value = false;

    function openMessage(message: Message) {
        if (message.unread) {
            gameService.setMessageRead(message.id).then(() => {
                const update = messages.data.value?.find(m => m.id === message.id);
                if (update) {
                    update.unread = false;
                    messages.notify();
                    if (!messages.data.value?.find(x => x.unread)) {
                        gameService.messageNotification.value = false;
                    }
                }
            });
        }
        openDialog(ReadMessage, {message});
    }

    async function allRead() {
        try {
            await gameService.setAllMessagesRead();
            messages.data.value?.forEach(m => m.unread = false);
            messages.notify();
            gameService.messageNotification.value = false;
        } catch (error) {
            handleError(error);
        }
    }

    context.onDestroy(gameService.bunker.observe(() => messages.refresh()));
    context.onDestroy(gameService.expeditionDone.observe(() => messages.refresh()));

    context.onDestroy(gameService.messageNotification.observe(unread => {
        if (unread) {
            messages.refresh();
            gameService.messageNotification.value = false;
        }
    }));

    return <>
        <div class='stack-row spacing margin-bottom justify-end'>
            <button onClick={allRead}>All Read</button>
        </div>
        <DerefData data={messages}>{messages =>
            <>
                <div class='stack-column' role='grid'>
                    <For each={messages}>{message =>
                        <button role='row' class='stack-row spacing' onClick={() => openMessage(message.value)} style={{fontWeight: message.props.unread.map(unread => unread ? 'bold' : 'normal')}}>
                            <div role='gridcell' class='grow' style='text-overflow: ellipsis; overflow: hidden; white-space: nowrap;'>{message.props.subject}</div>
                            <div role='gridcell'>{message.props.created.map(d => gameService.formatDateTime(d))}</div>
                        </button>
                        }</For>
                </div>
                <Show when={messages.map(p => !p.length)}>
                    <div>No messages</div>
                </Show>
            </>
            }</DerefData>
    </>;
}

function ReadMessage({message}: {
    message: Message,
}) {
    return <div class='stack-column spacing padding'>
        <div class='stack-row spacing'>
            <div style='font-weight: bold;'>
                From:
            </div>
            <div>
                {message.senderName}
            </div>
        </div>
        <div class='stack-row spacing'>
            <div style='font-weight: bold;'>
                Subject:
            </div>
            <div>
                {message.subject}
            </div>
        </div>
        <div style='white-space: pre-wrap;'>
            {message.body}
        </div>
    </div>
}
