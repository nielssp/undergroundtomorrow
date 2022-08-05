import {Fragment, createElement, ref, bind, For, Show, zipWith, ariaBool, bindList} from 'cstk';
import { differenceInYears, parseISO } from 'date-fns';
import { DialogRef, openDialog } from './dialog';
import {Inhabitant, Item, ItemType, Location} from './dto';
import { handleError } from './error';
import {GameService} from './services/game-service';
import { dataSource, DerefData, getDistance, formatDistance, getSectorName, formatDuration, getItemName } from './util';

interface Equiped {
    inhabitantId: number;
    name: string;
    weaponType?: ItemType;
    ammo: number;
}

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
    const page = bind<'team'|'equipment'|'confirm'>('team');
    const distance = getDistance({
        x: sector.x * 100 + 50,
        y: sector.y * 100 + 50,
    }, gameService.bunker.value || {x: 0, y: 0});

    const selection = bind<Set<number>>(new Set());
    const weapons = bind<Map<string, Item>>(new Map());
    const ammoTypes = bind<Map<string, Item>>(new Map());
    const members = bindList<Equiped>([]);
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
        teamSelected();
    }

    async function teamSelected() {
        const items = await gameService.getItems();
        const ammoTypeIds = new Set<string>();
        weapons.value = new Map(items.filter(i => i.itemType.weapon).map(i => {
            if (i.itemType.ammoType) {
                ammoTypeIds.add(i.itemType.ammoType);
            }
            return [i.itemType.id, i];
        }));
        ammoTypes.value = new Map(items.filter(i => ammoTypeIds.has(i.itemType.id)).map(i => [i.itemType.id, i]));
        members.updateAll(people.data.value?.filter(p => selection.value.has(p.id)).map(p => {
            let weaponType: ItemType|undefined;
            let ammo = 0;
            if (p.weaponType) {
                const weapon = weapons.value.get(p.weaponType);
                if (weapon && weapon.quantity > 0) {
                    weapon.quantity--;
                    weaponType = weapon.itemType;
                    if (weaponType.ammoType && p.ammo) {
                        const ammoType = ammoTypes.value.get(weaponType.ammoType);
                        if (ammoType) {
                            ammo = Math.min(p.ammo, ammoType.quantity);
                            ammoType.quantity -= ammo;
                        }
                    }
                }
            }
            return {
                inhabitantId: p.id,
                name: p.name,
                weaponType: weaponType,
                ammo: ammo,
            };
        }) || []);
        weapons.value = weapons.value;
        ammoTypes.value = ammoTypes.value;
        const speed = 5;
        eta.value = formatDuration((10 + 0.2 * distance / speed) * 60 / gameService.world.value!.timeAcceleration);
        page.value = 'equipment';
    }

    async function selectWeapon(index: number, member: Equiped) {
        await openDialog(SelectWeapon, {weapons: weapons.value, ammoTypes: ammoTypes.value});
    }

    async function create() {
        try {
            await gameService.createExpedition({
                zoneX: sector.x,
                zoneY: sector.y,
                locationId: location?.id,
                team: [...selection.value].map(inhabitantId => {
                    return {
                        inhabitantId,
                        ammo: 0,
                    };
                }),
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
        <Show when={page.eq('team')}>
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
                    <button onClick={teamSelected} disabled={selection.map(s => !s.size)}>Continue</button>
                </div>
            </Show>
        </Show>
        <Show when={page.eq('equipment')}>
            <div>Select equipment</div>
            <div class='stack-column' role='grid'>
                <For each={members}>{(member, index) =>
                    <button role='row' class='stack-row spacing justify-space-between' onClick={() => selectWeapon(index.value, member.value)}>
                        <div role='gridcell'>{member.props.name}</div>
                        <div role='gridcell'>{member.map(p => p.weaponType ? `${p.weaponType} [${p.ammo}]` : 'No weapon')}</div>
                    </button>
                }</For>
            </div>
            <div class='stack-row justify-space-between'>
                <button onClick={() => page.value = 'team'}>Back</button>
                <button onClick={() => page.value = 'confirm'}>Continue</button>
            </div>
        </Show>
        <Show when={page.eq('confirm')}>
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
                <For each={members}>{member => <div>{member.props.name}</div>}</For>
            </div>
            <div class='stack-row justify-space-between'>
                <button onClick={() => page.value = 'equipment'}>Back</button>
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


function SelectWeapon({weapons, ammoTypes}: {
    weapons: Map<string, Item>,
    ammoTypes: Map<string, Item>,
}) {
    const selection = ref<string>();
    return <div class='stack-column spacing padding'>
        <div class='stack-column' role='grid'>
            <button role='row'>
                <div role='gridcell' aria-selected={ariaBool(selection.undefined)} onClick={() => selection.value = undefined}>
                    No weapon
                </div>
            </button>
            <For each={bind([...weapons.values()])}>{weapon => 
                <Show when={weapon.map(w => w.quantity > 0)}>
                    <button role='row' aria-selected={ariaBool(selection.eq(weapon.props.itemType.props.id))} onClick={() => selection.value = weapon.value.itemType.id}>
                        <div role='gridcell' class='stack-row spacing'>
                            <div>{weapon.map(getItemName)}</div>
                            <Show when={weapon.props.quantity.map(q => q > 1)}>
                                <div>({weapon.props.quantity})</div>
                            </Show>
                        </div>
                    </button>
                </Show>
            }</For>
        </div>
    </div>;
}
