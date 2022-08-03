import {bind, createElement, Deref, Fragment, For, Show, Property, TextControl, IntControl, Field, zipWith} from "cstk";
import {openDialog, openPrompt} from "./dialog";
import {NewWorld, User} from "./dto";
import {handleError} from "./error";
import {AuthService} from "./services/auth-service";
import {GameService} from "./services/game-service";
import {LobbyService} from "./services/lobby-service";
import {dataSource, DerefData, LoadingIndicator} from "./util";

export function Lobby({user, authService, lobbyService, gameService}: {
    user: Property<User>,
    authService: AuthService,
    lobbyService: LobbyService,
    gameService: GameService,
}) {
    const worlds = dataSource(() => lobbyService.getWorlds());

    function reload() {
        worlds.refresh();
    }

    async function createWorld() {
        const world = await openDialog(CreateWorld, {});
        if (world) {
            await lobbyService.createWorld(world);
            reload();
        }
    }

    async function joinWorld(worldId: number) {
        try {
            await lobbyService.joinWorld(worldId);
            await gameService.selectWorld(worldId);
        } catch (error) {
            handleError(error)
        }
    }

    async function enterWorld(worldId: number) {
        try {
            await gameService.selectWorld(worldId);
        } catch (error) {
            handleError(error)
        }
    }

    return <div>
        <Show when={user.props.admin}>
            <div class='margin-bottom'>
                <button onClick={createWorld}>Create World</button>
            </div>
        </Show>
        <DerefData data={worlds}>{worlds =>
            <>
                <div class='stack-column spacing'>
                    <For each={worlds}>{world =>
                        <div class='stack-row spacing'>
                            <div class='grow'>{world.props.name}</div>
                            <Show when={world.props.joined}>
                                <button onClick={() => enterWorld(world.value.id)}>Enter</button>
                            </Show>
                            <Show when={world.props.joined.not}>
                                <button onClick={() => joinWorld(world.value.id)}>Join</button>
                            </Show>
                        </div>
                        }</For>
                </div>
                <Show when={worlds.map(w => !w.length)}>
                    <div>No worlds</div>
                </Show>
            </>
            }</DerefData>
    </div>;
}

function CreateWorld({close}: {
    close: (world: NewWorld) => void,
}) {
    const name = new TextControl('');
    const year = new IntControl(2072);
    const acceleration = new IntControl(1);
    acceleration.min = 1;
    const timeZone = new IntControl(-5);
    const invalid = zipWith([name, acceleration], (n, a) => !n || !a);

    function submit(e: Event) {
        e.preventDefault();
        close({
            name: name.value,
            open: true,
            startYear: year.value,
            timeAcceleration: acceleration.value,
            timeOffset: 3600 * timeZone.value,
        });
    }

    return <form class='padding stack-column spacing' onSubmit={submit}>
        <div class='stack-row spacing justify-space-between'>
            <Field control={name}>
                <label>Name</label>
                <input type='text'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={year}>
                <label>Year</label>
                <input type='number'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={acceleration}>
                <label>Acceleration</label>
                <input type='number'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <Field control={timeZone}>
                <label>Time Zone</label>
                <input type='number'/>
            </Field>
        </div>
        <div class='stack-row spacing justify-end'>
            <button type='submit' disabled={invalid}>Create</button>
        </div>
    </form>;
}
