import {Fragment, createElement, ref} from 'cstk';

export class MapService {
}

export function Map({}, context: JSX.Context) {
    return <>
        <MapCanvas/>
    </>;
}

function MapCanvas({}, context: JSX.Context) {
    const canvasRef = ref<HTMLCanvasElement>();
    context.onInit(async () => {
        if (!canvasRef.value) {
            return;
        }
        const canvas = canvasRef.value;
        const ctx = canvas.getContext('2d')!;
        const map = await loadTexture(require('./assets/map2.png'));
        ctx.drawImage(map, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#ff9900';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
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
