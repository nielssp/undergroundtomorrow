/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ariaBool, cell, Context, createElement, Deref, Field, For, Fragment, Cell, Show, TextControl, MutCell, zipWith } from 'cytoplasmic';
import { differenceInYears, format, parseISO } from 'date-fns';
import { openConfirm, openDialog } from './dialog';
import { Assignment, assignmentMap, assignments, Inhabitant } from './dto';
import { ErrorIndicator, handleError } from './error';
import { GameService, GameServiceContext } from './services/game-service';
import { applyFilter, dataSource, DerefData, LoadingIndicator, Select } from './util';

type PeopleFilter = {
    name: string,
    apply: (item: Inhabitant) => boolean,
};

const assignmentFilters: PeopleFilter[] = [
    {
        name: 'No Filter',
        apply: () => true,
    },
    ...Object.entries(assignmentMap).map(assignment => {
        return {
            name: assignment[1],
            apply: (p: Inhabitant) => p.assignment === assignment[0],
        };
    })
];

const statusFilters: PeopleFilter[] = [
    {
        name: 'No Filter',
        apply: () => true,
    },
    {
        name: 'Bleeding',
        apply: p => p.bleeding,
    },
    {
        name: 'Wounded',
        apply: p => p.wounded,
    },
    {
        name: 'Infection',
        apply: p => p.infection,
    },
    {
        name: 'Sick',
        apply: p => p.sick,
    },
    {
        name: 'Starving',
        apply: p => p.starving,
    },
    {
        name: 'Tired',
        apply: p => p.tired,
    },
    {
        name: 'Sleeping',
        apply: p => p.sleeping,
    },
];


export function People({}: {}, context: Context) {
    const gameService = context.use(GameServiceContext);

    const people = dataSource(() => gameService.getInhabitants());
    const activeAssignmentFilter = cell<PeopleFilter>(assignmentFilters[0]);
    const activeStatusFilter = cell<PeopleFilter>(statusFilters[0]);
    const teams = cell<string[]>([]);
    let alreadyAsked = false;

    async function openDetails(person: Cell<Inhabitant>) {
        await openDialog(Details, {person, gameService, teams, onReload: () => people.notify()});
        people.notify();
    }

    async function restart() {
        if (alreadyAsked) {
            return;
        }
        alreadyAsked = true;
        if (await openConfirm(`Everybody's dead, Dave. Would you like to try again?`, [
            {
                text: 'No',
                role: false,
            },
            {
                text: 'Restart',
                role: true,
            },
        ])) {
            try {
                await gameService.restart();
                people.refresh();
            } catch (error) {
                handleError(error);
            }
        }
    }

    async function assignmentFilter() {
        const selection: PeopleFilter|undefined = await openDialog(Select, {
            selection: activeAssignmentFilter.value,
            options: assignmentFilters,
            toString: (filter: PeopleFilter) => filter.name,
        });
        if (selection) {
            activeAssignmentFilter.value = selection;
        }
    }

    async function statusFilter() {
        const selection: PeopleFilter|undefined = await openDialog(Select, {
            selection: activeStatusFilter.value,
            options: statusFilters,
            toString: (filter: PeopleFilter) => filter.name,
        });
        if (selection) {
            activeStatusFilter.value = selection;
        }
    }

    context.onDestroy(people.data.getAndObserve(people => {
        if (people) {
            if (!people.length) {
                restart();
            }
            const unique = new Set<string>();
            people.forEach(p => p.team && unique.add(p.team));
            teams.value = [...unique].sort((a, b) => a.localeCompare(b));
        }
    }));

    context.onDestroy(gameService.bunker.observe(() => people.refresh()));
    context.onDestroy(gameService.expeditionDone.observe(() => people.refresh()));

    return <>
        <div class='stack-row justify-end spacing margin-bottom'>
            <button onClick={assignmentFilter}>Job</button>
            <button onClick={statusFilter}>Status</button>
        </div>
        <DerefData data={people}>{people =>
            <>
                <div class='stack-column' role='grid'>
                    <For each={applyFilter(applyFilter(people, activeAssignmentFilter), activeStatusFilter)}>{person =>
                        <button class='stack-row spacing' role='row' onClick={() => openDetails(person)}>
                            <div>{person.props.name}</div>
                            <div>({person.props.dateOfBirth.flatMap(dob => gameService.bindAge(dob))})</div>
                            <div style='margin-left: auto;'>{person.map(getStatus)}</div>
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

function Details({gameService, teams, person, onReload}: {
    person: Cell<Inhabitant>,
    gameService: GameService,
    teams: MutCell<string[]>,
    onReload: () => void,
}) {

    const age = gameService.bindAge(person.value.dateOfBirth);

    async function setAssignment() {
        const choice = await openDialog(SetAssignment, {person: person.value});
        if (choice) {
            const assignment = choice.length ? choice[0] : undefined;
            try {
                await gameService.setAssignment(person.value.id, assignment);
                person.value.assignment = assignment;
                onReload();
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
                onReload();
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
        <div class='stack-row spacing justify-space-between'>
            <div style='font-weight: bold'>Health:</div>
            <div>{person.props.health}%</div>
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
    teams: MutCell<string[]>,
    close: (team: [string]|[]) => void,
}) {
    const newTeam = new TextControl('');

    function createNewTeam(e: Event) {
        e.preventDefault();
        close([newTeam.value]);
    }

    return <div class='padding spacing stack-column'>
        <div role='grid' class='stack-column'>
            <button role='row' class='selectable' aria-selected={ariaBool(cell(!person.team))} onClick={() => close([])}>
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
            <button role='row' class='selectable' aria-selected={ariaBool(cell(!person.assignment))} onClick={() => close([])}>
                <div role='gridcell'>No Assignment</div>
            </button>
            <For each={cell(assignments)}>{assignment =>
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
        case 'repair':
            return 'Repair';
        case 'crafting':
            return 'Crafting';
        case 'cooking':
            return 'Cooking';
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

function getStatus(inhabitant: Inhabitant) {
    if (inhabitant.bleeding) {
        return '(bleeding)';
    } else if (inhabitant.infection) {
        return '(infection)';
    } else if (inhabitant.sick) {
        return '(sick)';
    } else if (inhabitant.wounded) {
        return '(wounded)';
    } else if (inhabitant.starving) {
        return '(starving)';
    } else if (inhabitant.recovering) {
        return '(recovering)';
    } else if (inhabitant.expeditionId) {
        return '(on mission)';
    } else if (inhabitant.sleeping) {
        return '(sleeping)';
    } else if (inhabitant.tired) {
        return '(tired)';
    } else if (inhabitant.assignment) {
        return mapAssignment(inhabitant.assignment);
    } else {
        return '';
    }
}
