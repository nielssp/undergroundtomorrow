import {bind, createElement, Deref, Field, For, Fragment, Show, TextControl, ValueProperty, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Inhabitant } from "./dto";
import { ErrorIndicator } from "./error";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, LoadingIndicator} from "./util";

export function People({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const people = dataSource(() => gameService.getInhabitants());
    const teams = bind<string[]>([]);

    function openDetails(person: Inhabitant) {
        openDialog(Details, {person, gameService, teams});
    }

    context.onDestroy(people.data.getAndObserve(people => {
        if (people) {
            const unique = new Set<string>();
            people.forEach(p => p.team && unique.add(p.team));
            teams.value = [...unique].sort((a, b) => a.localeCompare(b));
        }
    }));

    return <>
        <DerefData data={people}>{people =>
            <>
                <div class='stack-column' role='grid'>
                    <For each={people}>{person =>
                        <button class='stack-row spacing' role='row' onClick={() => openDetails(person.value)}>
                            <div>{person.props.name}</div>
                            <div>(Age: {zipWith([gameService.worldTime, person.props.dateOfBirth], (wt, dob) => {
                                return '' + differenceInYears(wt, parseISO(dob));
                            })})</div>
                            <Show when={person.props.expeditionId}>
                                <div style='margin-left: auto;'>(on mission)</div>
                            </Show>
                        </button>
                        }</For>
                </div>
                <Show when={people.map(p => !p.length)}>
                    <div>No people</div>
                </Show>
            </>
            }</DerefData>
    </>;
}

function Details({person, gameService, teams}: {
    person: Inhabitant,
    gameService: GameService,
    teams: ValueProperty<string[]>,
}) {

    async function setTeam() {
        const choice = await openDialog(SetTeam, {person, teams});
        if (choice) {
            const team = choice.length ? choice[0] : undefined;
            await gameService.setTeam(person.id, team);
            if (team && !teams.value.includes(team)) {
                teams.value.push(team);
                teams.value = teams.value;
            }
        }
    }

    return <div class='padding spacing stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Name:</div>
            <div>{person.name}</div>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Age:</div>
            <div>{gameService.worldTime.map(wt => '' + differenceInYears(wt, parseISO(person.dateOfBirth)))}</div>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Date of birth:</div>
            <div>{format(parseISO(person.dateOfBirth), 'MM/dd/yy')}</div>
        </div>
        {!person.team ? '' : <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Team:</div>
            <div>{person.team}</div>
        </div>}
        <For each={bind(person.skills)}>{skill =>
            <div class='stack-row spacing justify-space-between'>
                <div style='font-weight: bold'>{skill.props.skillType.map(mapSkillType)}:</div>
                <div>Level {skill.props.level}</div>
            </div>
        }</For>
        <div class='stack-row justify-end'>
            <button onClick={setTeam}>Set Team</button>
        </div>
    </div>;
}

function SetTeam({person, teams, close}: {
    person: Inhabitant,
    teams: ValueProperty<string[]>,
    close: (team: [string]|[]) => void,
}) {
    const newTeam = new TextControl('');

    function createNewTeam(e: Event) {
        e.preventDefault();
        close([newTeam.value]);
    }

    return <div class='padding spacing stack-column'>
        <div role='grid' class='stack-column'>
            <button role='row' class='stack-row spacing justify-space-between' onClick={() => close([])}>
                <div role='gridcell'>No Team</div>
            </button>
            <For each={teams}>{team =>
                <button role='row' class='stack-row spacing justify-space-between' onClick={() => close([team.value])}>
                    <div role='gridcell'>{team}</div>
                </button>
                }</For>
        </div>
        <form onSubmit={createNewTeam} class='stack-row spacing'>
            <div class='stack-row spacing justify-space-between align-center'>
                <Field control={newTeam}>
                    <label>New Team:</label>
                    <input type='text'/>
                </Field>
            </div>
            <div class='stack-row justify-end'>
                <button disabled={newTeam.not}>Create</button>
            </div>
        </form>
    </div>;
}

function mapSkillType(skillType: string): string {
    switch (skillType) {
        case 'combat':
            return 'Combat';
        case 'handToHand':
            return 'Hand-to-hand';
        case 'guns':
            return 'Guns';
        case 'science':
            return 'Science';
        case 'reactor':
            return 'Reactor';
        case 'botany':
            return 'Botany';
        case 'medicine':
            return 'Medicine';
        case 'firstAid':
            return 'First aid';
        case 'scavenging':
            return 'Scavenging';
        case 'exploration':
            return 'Exploration';
        default:
            return 'Unknown skill';
    }
}
