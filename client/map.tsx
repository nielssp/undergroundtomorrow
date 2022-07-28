import {Fragment, createElement, ref, Property, Deref, bind, For} from 'cstk';
import { Dialog, DialogRef, openAlert, openDialog } from './dialog';
import {Bunker, Location} from './dto';
import {GameService} from './services/game-service';
import { formatDistance, getDistance, getSectorName } from './util';

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
            const key = getSectorName({
                x: Math.floor(location.x / 100),
                y: Math.floor(location.y / 100)
            });
            if (!locationsBySector.has(key)) {
                locationsBySector.set(key, []);
            }
            locationsBySector.get(key)?.push(location);
        });
    }));

    function openLocations() {
        const bunker = gameService.bunker.value;
        if (!bunker) {
            return;
        }
        openDialog(LocationsDialog, {locations: locations.orElse([]), bunker});
    }

    function selectSector(sector: {x: number, y: number}) {
        const locations = locationsBySector.get(getSectorName(sector)) || [];
        openDialog(LocationDialog, {sector, locations});
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

function LocationsDialog({dialog, locations, bunker}: {
    dialog: DialogRef,
    locations: Property<Location[]>,
    bunker: Bunker,
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
                <button>Explore</button>
            </div>
            }</For>
    </div>;
}

function LocationDialog({dialog, sector, locations}: {
    dialog: DialogRef,
    sector: {x: number, y: number},
    locations: Location[],
}) {
    return <div class='stack-column spacing padding'>
        <div class='stack-row spacing align-center justify-space-between'>
            <div>Sector {getSectorName(sector)}</div>
            <button>Explore</button>
        </div>
        <For each={bind(locations)}>{location =>
            <div class='stack-row spacing align-center justify-space-between'>
                <div>{location.props.name}</div>
                <button>Explore</button>
            </div>
            }</For>
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
