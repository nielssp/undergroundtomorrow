import {Fragment, createElement, ref, bind, For, Show, zipWith, ariaBool} from 'cstk';
import { differenceInYears, parseISO } from 'date-fns';
import { DialogRef, openDialog } from './dialog';
import {Inhabitant, Location} from './dto';
import { handleError } from './error';
import {GameService} from './services/game-service';
import { dataSource, DerefData, getDistance, formatDistance, getSectorName, formatDuration } from './util';

export function CreateExpeditionDialog({dialog, gameService, sector, location, close}: {
    dialog: DialogRef,
    gameService: GameService,
    sector: {x: number, y: number},
    location?: Location,
    close: (choice: boolean) => void,
}, context: JSX.Context) {
    const people = dataSource(() => gameService.getInhabitants().then(people => people.filter(p => !p.expeditionId)));
    const teams = bind<string[]>([]);
    const custom = bind(false);
    const confirm = bind(false);
    const distance = getDistance({
        x: sector.x * 100 + 50,
        y: sector.y * 100 + 50,
    }, gameService.bunker.value || {x: 0, y: 0});

    const selection = bind<Set<number>>(new Set());
    const memberNames = bind<string[]>([]);
    const eta = bind<string>('');

    async function showTeamMember(inhabitant: Inhabitant) {
        const selected = selection.value.has(inhabitant.id);
        const choice = await openDialog(TeamMemberDetails, {inhabitant, gameService, selected});
        if (typeof choice !== 'undefined') {
            if (choice) {
                selection.value.add(inhabitant.id);
            } else {
                selection.value.delete(inhabitant.id);
            }
            selection.value = selection.value;
        }
    }

    function selectTeam(team: string) {
        selection.value.clear();
        people.data.value?.forEach(person => {
            if (person.team === team) {
                selection.value.add(person.id);
            }
        });
        selection.value = selection.value;
        showConfirmation();
    }

    function showConfirmation() {
        memberNames.value = people.data.value?.filter(p => selection.value.has(p.id)).map(p => p.name) || [];
        const speed = 5;
        eta.value = formatDuration((10 + 0.2 * distance / speed) * 60);
        confirm.value = true;
    }

    async function create() {
        try {
            await gameService.createExpedition({
                zoneX: sector.x,
                zoneY: sector.y,
                locationId: location?.id,
                team: [...selection.value],
            });
            close(true);
        } catch (error) {
            handleError(error);
        }
    }

    context.onDestroy(people.data.getAndObserve(people => {
        if (people) {
            const unique = new Set<string>();
            people.forEach(p => p.team && unique.add(p.team));
            teams.value = [...unique].sort((a, b) => a.localeCompare(b));
        }
    }));

    return <div class='stack-column spacing padding' style='overflow: hidden;'>
        <Show when={confirm.not}>
            <Show when={teams.map(t => t.length).and(custom.not)}>
                <div>Select team</div>
                <div class='stack-column' role='grid' style='overflow-y: auto;'>
                    <For each={teams}>{team =>
                        <button role='row' class='stack-row spacing justify-space-between' onClick={() => selectTeam(team.value)}>
                            <div role='gridcell'>{team}</div>
                        </button>
                        }</For>
                    <hr/>
                    <button role='row' onClick={() => custom.value = true}>Custom</button>
                </div>
            </Show>
            <Show when={teams.map(t => !t.length).or(custom)}>
                <div>Select team</div>
                <DerefData data={people}>{people =>
                    <>
                        <div class='stack-column' role='grid' style='overflow-y: auto;'>
                            <For each={people}>{person =>
                                <button role='row'
                                    onClick={() => showTeamMember(person.value)}
                                    aria-selected={ariaBool(zipWith([person, selection], (p, s) => s.has(p.id)))}>
                                    <div role='gridcell'>{person.props.name}</div>
                                </button>
                                }</For>
                        </div>
                        <Show when={people.map(p => !p.length)}>
                            <div>No people</div>
                        </Show>
                    </>
                    }</DerefData>
                <div class='stack-row justify-end'>
                    <Show when={custom}>
                        <button onClick={() => custom.value = false} style='margin-right: auto;'>Back</button>
                    </Show>
                    <button onClick={showConfirmation} disabled={selection.map(s => !s.size)}>Continue</button>
                </div>
            </Show>
        </Show>
        <Show when={confirm}>
            <div>Confirm mission</div>
            <div class='stack-row justify-space-between'>
                <strong>Sector:</strong>
                <div>{getSectorName(sector)}</div>
            </div>
            <div class='stack-row justify-space-between'>
                <strong>Distance:</strong>
                <div>{formatDistance(distance)}</div>
            </div>
            <div class='stack-row justify-space-between'>
                <strong>ETA:</strong>
                <div>{eta}</div>
            </div>
            <strong>Team:</strong>
            <div class='stack-column align-end margin-bottom'>
                <For each={memberNames}>{name => <div>{name}</div>}</For>
            </div>
            <div class='stack-row justify-space-between'>
                <button onClick={() => confirm.value = false}>Back</button>
                <button onClick={create} disabled={selection.map(s => !s.size)}>Confirm</button>
            </div>
        </Show>
    </div>;
}

function TeamMemberDetails({dialog, inhabitant, selected, gameService, close}: {
    dialog: DialogRef,
    inhabitant: Inhabitant,
    selected: boolean,
    gameService: GameService,
    close: (choice: boolean) => void,
}, context: JSX.Context) {
    const primaryButton = ref<HTMLButtonElement>();
    function select() {
        close(!selected);
    }
    context.onInit(() => {
        primaryButton.value?.focus();
    });
    return <div class='stack-column spacing padding'>
        <div class='stack-row spacing justify-space-between'>
            <div>Name:</div>
            <div>{inhabitant.name}</div>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <div>Age:</div>
            <div>{gameService.worldTime.map(wt => '' + differenceInYears(wt, parseISO(inhabitant.dateOfBirth)))}</div>
        </div>
        <div class='stack-row spacing justify-end'>
            <button onClick={() => dialog.close()}>Cancel</button>
            {selected
                ? <button onClick={select} ref={primaryButton}>Unselect</button>
                : <button onClick={select} ref={primaryButton}>Select</button>}
        </div>
    </div>;
}

