/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Fragment, createElement, ref, Cell, Deref, cell, For, Show, Context } from 'cytoplasmic';
import { DialogRef, openDialog } from './dialog';
import { Bunker, Expedition, Location, Sector } from './dto';
import { CreateExpeditionDialog } from './expedition';
import { GameService, GameServiceContext } from './services/game-service';
import { DataSource, dataSource, DerefData, formatDistance, formatEta, getDistance, getSector, getSectorName } from './util';

export class MapService {
}

export function Map({amber}: {
    amber: Cell<boolean>,
}, context: Context) {
    const gameService = context.use(GameServiceContext);

    const expeditions = dataSource(() => gameService.getExpeditions());
    const locations = dataSource(() => gameService.getLocations());
    const sectors = dataSource(() => gameService.getSectors());
    const locationsBySector: Map<string, Location[]> = new window.Map();

    context.onDestroy(locations.data.observe(locations => {
        locationsBySector.clear();
        locations?.forEach(location => {
            const key = getSectorName(getSector(location));
            if (!locationsBySector.has(key)) {
                locationsBySector.set(key, []);
            }
            locationsBySector.get(key)?.push(location);
        });
    }));

    async function createExpedition(sector: {x: number, y: number}, location?: Location) {
        const result = await openDialog(CreateExpeditionDialog, {gameService, sector, location});
        if (result) {
            expeditions.refresh();
        }
    }

    function openExpeditions() {
        openDialog(ExpeditionsDialog, {
            expeditions,
        });
    }

    function openLocations() {
        const bunker = gameService.bunker.value;
        if (!bunker) {
            return;
        }
        openDialog(LocationsDialog, {
            locations: locations.data.orElse([]),
            bunker,
            onExplore: (location: Location) => createExpedition(getSector(location), location),
        });
    }

    function selectSector(sector: {x: number, y: number}) {
        const locations = locationsBySector.get(getSectorName(sector)) || [];
        openDialog(LocationDialog, {
            sector,
            explored: !!sectors.data.value?.find(s => s.x === sector.x && s.y === sector.y),
            locations,
            onExplore: (location?: Location) => createExpedition(sector, location),
        });
    }

    context.onDestroy(gameService.expeditionDone.observe(() => {
        expeditions.refresh();
        locations.refresh();
        sectors.refresh();
    }));

    return <>
    <div class='stack-row spacing margin-bottom justify-end'>
        <button onClick={openExpeditions}>Missions</button>
        <button onClick={openLocations}>Locations</button>
    </div>
    <Deref ref={gameService.bunker}>{bunker =>
        <div style='flex-grow: 1; display: flex; overflow: hidden;'>
            <MapCanvas amber={amber} bunker={bunker} locations={locations.data.orElse([])}
                sectors={sectors.data.orElse([])} expeditions={expeditions.data.orElse([])} onSelect={selectSector}/>
        </div>
    }</Deref>
</>;
}

function ExpeditionsDialog({dialog, expeditions}: {
    dialog: DialogRef,
    expeditions: DataSource<Expedition[]>,
}, context: Context) {
    const emitter = cell(null);
    const interval = setInterval(() => emitter.value = null, 1000);
    context.onDestroy(() => clearInterval(interval));
    return <div class='stack-column spacing padding'>
        <DerefData data={expeditions}>{expeditions =>
            <>
                <For each={expeditions}>{expedition =>
                    <div class='stack-row spacing'>
                        <div class='grow'>Sector {expedition.map(e => getSectorName({x: e.zoneX, y: e.zoneY}))}</div>
                        <div>ETA {emitter.flatMap(() => expedition.props.eta.map(d => formatEta(d)))}</div>
                    </div>
                    }</For>
                <Show when={expeditions.map(e => !e.length)}>
                    <div>No active missions</div>
                </Show>
            </>
            }</DerefData>
    </div>;
}

function LocationsDialog({dialog, locations, bunker, onExplore}: {
    dialog: DialogRef,
    locations: Cell<Location[]>,
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
                <button onClick={() => {dialog.close(); onExplore(location.value);}}>Search</button>
            </div>
            }</For>
    </div>;
}

function LocationDialog({dialog, explored, sector, locations, onExplore}: {
    dialog: DialogRef,
    explored: boolean,
    sector: {x: number, y: number},
    locations: Location[],
    onExplore: (location?: Location) => void,
}) {
    return <div class='stack-column spacing padding'>
        <div class='stack-row spacing align-center justify-space-between'>
            <div>Sector {getSectorName(sector)}</div>
            <button onClick={() => {dialog.close(); onExplore();}}>Explore</button>
        </div>
        <Show when={cell(explored)}>
            <div>Explored</div>
        </Show>
        <strong>Locations</strong>
        <For each={cell(locations)}>{location =>
            <div class='stack-row spacing align-center justify-space-between'>
                <div>{location.props.name}</div>
                <button onClick={() => {dialog.close(); onExplore(location.value);}}>Search</button>
            </div>
            }</For>
    </div>;
}

function MapCanvas({amber, bunker, locations, sectors, expeditions, onSelect}: {
    amber: Cell<boolean>,
    bunker: Cell<Bunker>,
    locations: Cell<Location[]>, 
    sectors: Cell<Sector[]>, 
    expeditions: Cell<Expedition[]>, 
    onSelect: (sector: {x: number, y: number}) => void,
}, context: Context) {
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
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `hsla(${hue}, 100%, 25%, 25%)`;
        for (let sector of sectors.value) {
            ctx.fillRect(canvas.width / 26 * sector.x, canvas.height / 26 * sector.y, canvas.width / 26, canvas.height / 26);
        }
        if (sector) {
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

        for (let location of locations.value) {
            let size = 3;
            if (location.locationType === 'house' || location.locationType === 'apartment_building' || location.locationType === 'factory') {
                ctx.fillStyle = `hsl(${hue}, 100%, 40%)`;
                size = 2;
            } else {
                ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
            }
            ctx.fillRect(location.x / 2600 * canvas.width - size * dpr, location.y / 2600 * canvas.height - size * dpr, size * 2 * dpr, size * 2 * dpr);
        }

        const bunkerX = bunker.value.x / 2600 * canvas.width;
        const bunkerY = bunker.value.y / 2600 * canvas.height;

        ctx.strokeStyle = `hsl(${hue}, 100%, 35%)`;
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([4 * dpr, 2 * dpr]);
        for (let expedition of expeditions.value) {
            let x = expedition.zoneX / 26 * canvas.width;
            let y = expedition.zoneY / 26 * canvas.height;
            ctx.beginPath();
            ctx.moveTo(bunkerX, bunkerY);
            ctx.lineTo(x + canvas.width / 52, y + canvas.height / 52);
            ctx.moveTo(x, y);
            ctx.lineTo(x + canvas.width / 26, y);
            ctx.lineTo(x + canvas.width / 26, y + canvas.height / 26);
            ctx.lineTo(x, y + canvas.height / 26);
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(bunkerX - 5 * dpr, bunkerY - 5 * dpr, 10 * dpr, 10 * dpr);
        ctx.fillStyle = '#000';
        ctx.fillRect(bunkerX - 4 * dpr, bunkerY - 4 * dpr, 8 * dpr, 8 * dpr);
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(bunkerX - 3 * dpr, bunkerY - 3 * dpr, 6 * dpr, 6 * dpr);

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

    function onResize() {
        repaint = true;
    }

    context.onInit(() => {
        render();
        canvasRef.value?.addEventListener('mousemove', onMosueMove);
        canvasRef.value?.addEventListener('mouseout', onMouseOut);
        canvasRef.value?.addEventListener('click', onClick);
        window.addEventListener('resize', onResize);
    });

    context.onDestroy(() => {
        destroyed = true;
        canvasRef.value?.removeEventListener('mousemove', onMosueMove);
        canvasRef.value?.removeEventListener('mouseout', onMouseOut);
        canvasRef.value?.removeEventListener('click', onClick);
        window.removeEventListener('resize', onResize);
    });

    context.onDestroy(amber.observe(() => repaint = true));
    context.onDestroy(bunker.observe(() => repaint = true));
    context.onDestroy(locations.observe(() => repaint = true));
    context.onDestroy(sectors.observe(() => repaint = true));
    context.onDestroy(expeditions.observe(() => repaint = true));

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
