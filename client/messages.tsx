import {bind, createElement, Deref, For, Fragment, Show, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Message } from "./dto";
import { handleError } from "./error";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, LoadingIndicator} from "./util";

export function Messages({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const messages = dataSource(() => gameService.getMessages());

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

    return <>
        <div class='stack-row spacing margin-bottom justify-end'>
            <button onClick={allRead}>All Read</button>
            <button>New</button>
        </div>
        <DerefData data={messages}>{messages =>
            <>
                <div class='stack-column' role='grid'>
                    <For each={messages}>{message =>
                        <button role='row' class='stack-row spacing' onClick={() => openMessage(message.value)} style={{fontWeight: message.props.unread.map(unread => unread ? 'bold' : 'normal')}}>
                            <div role='gridcell' class='grow'>{message.props.subject}</div>
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
