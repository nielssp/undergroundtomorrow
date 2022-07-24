import {bind, createElement, Deref, Fragment, For, Show, Property} from "cstk";
import {openPrompt} from "./dialog";
import {User} from "./dto";
import {handleError} from "./error";
import {AuthService} from "./services/auth-service";
import {GameService} from "./services/game-service";
import {LobbyService} from "./services/lobby-service";
import {LoadingIndicator} from "./util";

export function Lobby({user, authService, lobbyService, gameService}: {
    user: Property<User>,
    authService: AuthService,
    lobbyService: LobbyService,
    gameService: GameService,
}) {
    const error = bind(false);
    const worldPromise = bind(lobbyService.getWorlds());
    const worlds = worldPromise.await(() => error.value = true);

    function reload() {
        worldPromise.value = lobbyService.getWorlds();
    }

    async function createWorld() {
        const name = await openPrompt('Create World', 'World Name');
        if (name) {
            await lobbyService.createWorld({
                name,
                open: true,
                startYear: 2072,
                timeAcceleration: 1,
                timeOffset: -3600 * 5,
            });
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
        <LoadingIndicator loading={worlds.not.and(error.not)}/>
        <Show when={error}>
            <div>ERROR</div>
        </Show>
        <Deref ref={worlds}>{worlds =>
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
            }</Deref>
    </div>;
}
