import {Fragment, createElement, ref, Property, Deref} from 'cstk';
import {Bunker} from './dto';
import {GameService} from './services/game-service';

export class MapService {
}

export function Map({amber, gameService}: {
    amber: Property<boolean>,
    gameService: GameService,
}, context: JSX.Context) {
    return <>
    <Deref ref={gameService.bunker}>{bunker =>
        <MapCanvas amber={amber} bunker={bunker}/>
        }</Deref>
</>;
}

function MapCanvas({amber, bunker}: {
    amber: Property<boolean>,
    bunker: Property<Bunker>,
}, context: JSX.Context) {
    const canvasRef = ref<HTMLCanvasElement>();
    let mapTexture: HTMLImageElement|undefined;
    loadTexture(require('./assets/map2.png')).then(texture => {
        mapTexture = texture;
        render();
    });

    function render() {
        if (!canvasRef.value || !mapTexture) {
            return;
        }

        const canvas = canvasRef.value;
        const dpr = window.devicePixelRatio || 1;
        if (canvas.clientWidth * dpr !== canvas.width || canvas.clientHeight * dpr !== canvas.height) {
            canvas.width = canvas.clientWidth * dpr;
            canvas.height = canvas.clientHeight * dpr;
        }
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(mapTexture, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.fillRect(bunker.value.x / 2600 * canvas.width - 5 * dpr, bunker.value.y / 2600 * canvas.height - 5 * dpr, 10 * dpr, 10 * dpr);
        ctx.strokeRect(bunker.value.x / 2600 * canvas.width - 3 * dpr, bunker.value.y / 2600 * canvas.height - 3 * dpr, 6 * dpr, 6 * dpr);
        ctx.globalCompositeOperation = 'multiply';
        const style = getComputedStyle(document.documentElement);
        const hue = style.getPropertyValue('--primary-hue');
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.onInit(async () => {
        render();
    });

    context.onDestroy(amber.observe(() => render()));

    context.onDestroy(bunker.observe(() => render()));

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
