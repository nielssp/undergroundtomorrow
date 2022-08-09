import {createElement, For, Property, Show} from "cstk";
import { openConfirm, openDialog } from "./dialog";
import { WorkshopProject, WorkshopStatus } from "./dto";
import { handleError } from "./error";
import {GameService} from "./services/game-service";

export function Workshop({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<WorkshopStatus>,
    onReload: () => void,
}) {

    function manage() {
        openDialog(ManageProjects, {gameService, status, onReload});
    }

    return <div class='stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <strong>Workshop</strong>
        </div>
        <div class='stack-row spacing align-center'>
            <div>Projects: {status.map(s => s.projects.length)}</div>
            <button style='margin-left: auto;' onClick={manage}>Manage</button>
        </div>
    </div>;
}

export function ManageProjects({gameService, status, onReload}: {
    gameService: GameService,
    status: Property<WorkshopStatus>,
    onReload: () => void,
}) {

    async function add() {
        if (await openDialog(AddProject, {gameService})) {
            onReload();
        }
    }

    async function remove(project: WorkshopProject, index: number) {
        if (await openConfirm(`Cancel ${project.itemType}?`)) {
            try {
                await gameService.removeProject(index);
                onReload();
            } catch (error) {
                handleError(error);
            }
        }
    }

    return <div class='stack-column spacing padding'>
        <For each={status.props.projects}>{(project, index) => 
            <div class='stack-column'>
                <div class='stack-row spacing justify-space-between'>
                    <strong>{project.props.itemType} ({project.props.quantity})</strong>
                    <div>{project.map(c => Math.floor(c.progress / c.max * 100))}%</div>
                </div>
                <div class='stack-row spacing justify-space-between'>
                    <div>
                        <Show when={project.props.produced}><div>{project.props.produced} produced</div></Show>
                    </div>
                    <button onClick={() => remove(project.value, index.value)}>Cancel</button>
                </div>
            </div>
        }</For>
        <Show when={status.map(s => !s.projects.length)}>
            <div>No active projects</div>
        </Show>
        <div class='stack-row spacing justify-end'>
            <button onClick={add}>Add</button>
        </div>
    </div>;
}

function AddProject({gameService}: {
    gameService: GameService,
}) {
    return <div class='padding spacing stack-column'>
    </div>;
}
