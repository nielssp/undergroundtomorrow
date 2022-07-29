import {Fragment, createElement, ref, Property, Deref, bind, For, Show, zipWith, ariaBool} from 'cstk';
import { differenceInYears, parseISO } from 'date-fns';
import { Dialog, DialogRef, openAlert, openDialog } from './dialog';
import {Bunker, Inhabitant, Location} from './dto';
import { handleError } from './error';
import {GameService} from './services/game-service';
import { formatDistance, getDistance, getSector, getSectorName, LoadingIndicator } from './util';

export class MapService {
}

export function Map({amber, gameService}: {
    amber: Property<boolean>,
    gameService: GameService,
}, context: JSX.Context) {
    const error = bind(false);
    const promise = bind(gameService.getLocations());
    const locations = promise.await(() => error.value = true);
    const locationsBySector: Map<string, Location[]> = new window.Map();

    context.onDestroy(locations.observe(locations => {
        locationsBySector.clear();
        locations?.forEach(location => {
            const key = getSectorName(getSector(location));
            if (!locationsBySector.has(key)) {
                locationsBySector.set(key, []);
            }
            locationsBySector.get(key)?.push(location);
        });
    }));

    function createExpedition(sector: {x: number, y: number}, location?: Location) {
        openDialog(CreateExpeditionDialog, {gameService, sector, location});
    }

    function openLocations() {
        const bunker = gameService.bunker.value;
        if (!bunker) {
            return;
        }
        openDialog(LocationsDialog, {
            locations: locations.orElse([]),
            bunker,
            onExplore: (location: Location) => createExpedition(getSector(location), location),
        });
    }

    function selectSector(sector: {x: number, y: number}) {
        const locations = locationsBySector.get(getSectorName(sector)) || [];
        openDialog(LocationDialog, {
            sector,
            locations,
            onExplore: (location?: Location) => createExpedition(sector, location),
        });
    }

    return <>
    <div class='stack-row spacing margin-bottom justify-end'>
        <button onClick={openLocations}>Locations</button>
    </div>
    <Deref ref={gameService.bunker}>{bunker =>
        <div style='flex-grow: 1; display: flex; overflow: hidden;'>
            <MapCanvas amber={amber} bunker={bunker} locations={locations.orElse([])} onSelect={selectSector}/>
        </div>
    }</Deref>
</>;
}

function LocationsDialog({dialog, locations, bunker, onExplore}: {
    dialog: DialogRef,
    locations: Property<Location[]>,
    bunker: Bunker,
    onExplore: (location: Location) => void,
}) {
    const sorted = locations.map(locations => {
        return locations.map(l => {
            return {distance: getDistance(l, bunker), ...l};
        }).sort((a, b) => a.distance - b.distance);
    });
    return <div class='stack-column spacing padding'>
        <For each={sorted}>{location =>
            <div class='stack-row spacing'>
                <div class='grow'>{location.props.name}</div>
                <div>{location.props.distance.map(formatDistance)}</div>
                <button onClick={() => {dialog.close(); onExplore(location.value);}}>Explore</button>
            </div>
            }</For>
    </div>;
}

function LocationDialog({dialog, sector, locations, onExplore}: {
    dialog: DialogRef,
    sector: {x: number, y: number},
    locations: Location[],
    onExplore: (location?: Location) => void,
}) {
    return <div class='stack-column spacing padding'>
        <div class='stack-row spacing align-center justify-space-between'>
            <div>Sector {getSectorName(sector)}</div>
            <button onClick={() => {dialog.close(); onExplore();}}>Explore</button>
        </div>
        <For each={bind(locations)}>{location =>
            <div class='stack-row spacing align-center justify-space-between'>
                <div>{location.props.name}</div>
                <button onClick={() => {dialog.close(); onExplore(location.value);}}>Explore</button>
            </div>
            }</For>
    </div>;
}

function CreateExpeditionDialog({dialog, gameService, sector, location}: {
    dialog: DialogRef,
    gameService: GameService,
    sector: {x: number, y: number},
    location?: Location,
}) {
    const error = bind(false);
    const promise = bind(gameService.getInhabitants());
    const people = promise.await(() => error.value = true).mapDefined(p => p.filter(i => !i.expeditionId));

    const selection = bind<Set<number>>(new Set());

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

    async function create() {
        try {
            await gameService.createExpedition({
                zoneX: sector.x,
                zoneY: sector.y,
                locationId: location?.id,
                team: [...selection.value],
            });
            dialog.close();
        } catch (error) {
            handleError(error);
        }
    }

    return <div class='stack-column spacing padding' style='overflow: hidden;'>
        <div>Select expedition team</div>
        <LoadingIndicator loading={people.not.and(error.not)}/>
        <Show when={error}>
            <div>ERROR</div>
        </Show>
        <Deref ref={people}>{people =>
            <>
                <div class='stack-column spacing' style='overflow-y: auto;' role='listbox'>
                    <For each={people}>{person =>
                        <div class='stack-row spacing' tabIndex={0} role='option'
                            onClick={() => showTeamMember(person.value)}
                            onKeyDown={e => e.key === 'Enter' && showTeamMember(person.value)}
                            aria-selected={ariaBool(zipWith([person, selection], (p, s) => s.has(p.id)))}>
                            <div>{person.props.name}</div>
                        </div>
                        }</For>
                </div>
                <Show when={people.map(p => !p.length)}>
                    <div>No people</div>
                </Show>
            </>
            }</Deref>
        <div class='stack-row justify-end'>
            <button onClick={create} disabled={selection.map(s => !s.size)}>Create</button>
        </div>
    </div>;
}

function TeamMemberDetails({dialog, inhabitant, selected, gameService, onChoice}: {
    dialog: DialogRef,
    inhabitant: Inhabitant,
    selected: boolean,
    gameService: GameService,
    onChoice: (choice: boolean) => void,
}) {
    function select() {
        onChoice(!selected);
        dialog.close();
    }
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
                ? <button onClick={select}>Unselect</button>
                : <button onClick={select}>Select</button>}
        </div>
    </div>;
}

function MapCanvas({amber, bunker, locations, onSelect}: {
    amber: Property<boolean>,
    bunker: Property<Bunker>,
    locations: Property<Location[]>, 
    onSelect: (sector: {x: number, y: number}) => void,
}, context: JSX.Context) {
    const canvasRef = ref<HTMLCanvasElement>();
    let repaint = true;
    let destroyed = false;
    let mapTexture: HTMLImageElement|undefined;
    loadTexture(require('./assets/map3.png')).then(texture => {
        mapTexture = texture;
        repaint = true;
    });
    let sector: [number, number]|undefined;

    function render() {
        if (!repaint || destroyed || !canvasRef.value || !mapTexture) {
            if (!destroyed) {
                requestAnimationFrame(render);
            }
            return;
        }

        repaint = false;
        const canvas = canvasRef.value;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.clientWidth * dpr !== canvas.width || canvas.clientHeight * dpr !== canvas.height) {
            canvas.width = canvas.clientWidth * dpr;
            canvas.height = canvas.clientHeight * dpr;
        }
        const ctx = canvas.getContext('2d')!;
        ctx.lineWidth = dpr;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(mapTexture, 0, 0, canvas.width, canvas.height);
        const style = getComputedStyle(document.documentElement);
        const hue = style.getPropertyValue('--primary-hue');
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `hsl(${hue}, 100%, 25%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (sector) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `hsla(${hue}, 100%, 25%, 25%)`;
            ctx.fillRect(canvas.width / 26 * sector[0], canvas.height / 26 * sector[1], canvas.width / 26, canvas.height / 26);
        }
        ctx.globalCompositeOperation = 'source-over';

        ctx.strokeStyle = '#00000080';
        for (let i = 1; i < 26; i++) {
            let x = canvas.width / 26 * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let i = 1; i < 26; i++) {
            let y = canvas.height / 26 * i;
            ctx.beginPath();
            ctx.moveTo(0, y,);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        for (let location of locations.value) {
            ctx.fillRect(location.x / 2600 * canvas.width - 3 * dpr, location.y / 2600 * canvas.height - 3 * dpr, 6 * dpr, 6 * dpr);
        }

        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(bunker.value.x / 2600 * canvas.width - 5 * dpr, bunker.value.y / 2600 * canvas.height - 5 * dpr, 10 * dpr, 10 * dpr);
        ctx.fillStyle = '#000';
        ctx.fillRect(bunker.value.x / 2600 * canvas.width - 4 * dpr, bunker.value.y / 2600 * canvas.height - 4 * dpr, 8 * dpr, 8 * dpr);
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(bunker.value.x / 2600 * canvas.width - 3 * dpr, bunker.value.y / 2600 * canvas.height - 3 * dpr, 6 * dpr, 6 * dpr);

        requestAnimationFrame(render);
    }

    function onMosueMove(event: MouseEvent) {
        if (!canvasRef.value) {
            return;
        }
        const rect = canvasRef.value.getBoundingClientRect();
        const x = Math.floor(26 * (event.pageX - rect.left) / canvasRef.value.clientWidth);
        const y = Math.floor(26 * (event.pageY - rect.top) / canvasRef.value.clientHeight);
        if (!sector || sector[0] !== x || sector[1] !== y) {
            sector = [x, y];
            repaint = true;
        }
    }

    function onMouseOut(event: MouseEvent) {
        if (sector) {
            sector = undefined;
            repaint = true;
        }
    }

    function onClick(event: MouseEvent) {
        if (!canvasRef.value) {
            return;
        }
        const rect = canvasRef.value.getBoundingClientRect();
        const x = Math.floor(26 * (event.pageX - rect.left) / canvasRef.value.clientWidth);
        const y = Math.floor(26 * (event.pageY - rect.top) / canvasRef.value.clientHeight);
        onSelect({x, y});
    }

    context.onInit(() => {
        render();
        canvasRef.value?.addEventListener('mousemove', onMosueMove);
        canvasRef.value?.addEventListener('mouseout', onMouseOut);
        canvasRef.value?.addEventListener('click', onClick);
    });

    context.onDestroy(() => {
        destroyed = true;
        canvasRef.value?.removeEventListener('mousemove', onMosueMove);
        canvasRef.value?.removeEventListener('mouseout', onMouseOut);
        canvasRef.value?.removeEventListener('click', onClick);
    });

    context.onDestroy(amber.observe(() => repaint = true));
    context.onDestroy(bunker.observe(() => repaint = true));
    context.onDestroy(locations.observe(() => repaint = true));

    return <canvas style='flex-grow: 1; width: 100%;' ref={canvasRef}/>;
}

function loadTexture(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}
