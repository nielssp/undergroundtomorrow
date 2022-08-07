import {ariaBool, bind, createElement, Deref, Field, For, Fragment, Show, TextControl, ValueProperty, zipWith} from "cstk";
import {differenceInYears, format, parseISO} from "date-fns";
import { openDialog } from "./dialog";
import { Assignment, assignmentMap, assignments, Inhabitant } from "./dto";
import { ErrorIndicator, handleError } from "./error";
import {GameService} from "./services/game-service";
import {dataSource, DerefData, LoadingIndicator} from "./util";

export function People({gameService}: {
    gameService: GameService,
}, context: JSX.Context) {
    const people = dataSource(() => gameService.getInhabitants());
    const teams = bind<string[]>([]);

    async function openDetails(person: Inhabitant) {
        await openDialog(Details, {person, gameService, teams});
        people.notify();
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
                            <div>(Age: {person.props.dateOfBirth.flatMap(dob => gameService.bindAge(dob))})</div>
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

function Details({gameService, teams, ...props}: {
    person: Inhabitant,
    gameService: GameService,
    teams: ValueProperty<string[]>,
}) {
    const person = bind(props.person);

    const age = gameService.bindAge(props.person.dateOfBirth);

    async function setAssignment() {
        const choice = await openDialog(SetAssignment, {person: person.value});
        if (choice) {
            const assignment = choice.length ? choice[0] : undefined;
            try {
                await gameService.setAssignment(person.value.id, assignment);
                person.value.assignment = assignment;
                person.value = person.value;
            } catch (error) {
                handleError(error);
            }
        }
    }

    async function setTeam() {
        const choice = await openDialog(SetTeam, {person: person.value, teams});
        if (choice) {
            const team = choice.length ? choice[0] : undefined;
            try {
                await gameService.setTeam(person.value.id, team);
                person.value.team = team;
                person.value = person.value;
                if (team && !teams.value.includes(team)) {
                    teams.value.push(team);
                    teams.value = teams.value;
                }
            } catch (error) {
                handleError(error);
            }
        }
    }

    return <div class='padding spacing stack-column'>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Name:</div>
            <div>{person.props.name}</div>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Age:</div>
            <div>{age}</div>
        </div>
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Date of birth:</div>
            <div>{format(parseISO(person.value.dateOfBirth), 'MM/dd/yy')}</div>
        </div>
        <Deref ref={person.props.assignment}>{assignment => 
            <div class='stack-row spacing justify-space-between'>
                <div style='font-weight: bold'>Assignment:</div>
                <div>{assignment.map(mapAssignment)}</div>
            </div>
        }</Deref>
        <Deref ref={person.props.team}>{team => 
            <div class='stack-row spacing justify-space-between'>
                <div style='font-weight: bold'>Team:</div>
                <div>{team}</div>
            </div>
        }</Deref>
        <For each={person.props.skills.map(skills => skills.sort((a, b) => b.xp - a.xp))}>{skill =>
            <div class='stack-row spacing justify-space-between'>
                <div style='font-weight: bold'>{skill.props.skillType.map(mapSkillType)}:</div>
                <div>Level {skill.props.level}</div>
            </div>
        }</For>
        <Show when={age.map(a => a >= 16)}>
            <div class='stack-row justify-end spacing'>
                <button onClick={setAssignment}>Set Job</button>
                <button onClick={setTeam}>Set Team</button>
            </div>
        </Show>
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
            <button role='row' class='selectable' aria-selected={ariaBool(bind(!person.team))} onClick={() => close([])}>
                <div role='gridcell'>No Team</div>
            </button>
            <For each={teams}>{team =>
                <button role='row' class='selectable' aria-selected={ariaBool(team.eq(person.team))} onClick={() => close([team.value])}>
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

function SetAssignment({person, close}: {
    person: Inhabitant,
    close: (assignment: [Assignment]|[]) => void,
}) {
    return <div class='padding spacing stack-column'>
        <div role='grid' class='stack-column'>
            <button role='row' class='selectable' aria-selected={ariaBool(bind(!person.assignment))} onClick={() => close([])}>
                <div role='gridcell'>No Assignment</div>
            </button>
            <For each={bind(assignments)}>{assignment =>
                <button role='row' class='selectable' aria-selected={ariaBool(assignment.eq(person.assignment))} onClick={() => close([assignment.value])}>
                    <div role='gridcell'>{assignment.map(mapAssignment)}</div>
                </button>
                }</For>
        </div>
    </div>;
}

function mapSkillType(skillType: string): string {
    switch (skillType) {
        case 'combat':
            return 'Combat';
        case 'unarmed':
            return 'Unarmed';
        case 'guns':
            return 'Guns';
        case 'meleeWeapons':
            return 'Melee Weapons';
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
        case 'stealth':
            return 'Stealth';
        default:
            return skillType;
    }
}

function mapAssignment(assignment: Assignment): string {
    if (assignmentMap.hasOwnProperty(assignment)) {
        return assignmentMap[assignment];
    }
    return assignment;
}
