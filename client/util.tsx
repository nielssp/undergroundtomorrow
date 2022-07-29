import {Property, Show, createElement} from "cstk";

export function LoadingIndicator({loading}: {
    loading: Property<any>,
}) {
    return <Show when={loading}>
        <div class='stack-row spacing'>
            <div class='spinner'></div>
            <div>Please wait...</div>
        </div>
    </Show>;
}

export function getSectorName({x, y}: {x: number, y: number}): string {
    return `${String.fromCharCode(0x41 + x)}${y + 1}`;
}

export function getDistance(a: {x: number, y: number}, b: {x: number, y: number}) {
    const deltaX = a.x - b.x;
    const deltaY = a.y - b.y;
    return Math.floor(Math.sqrt(deltaX * deltaX + deltaY * deltaY) * 10);
}

export function formatDistance(meters: number) {
    if (meters < 1000) {
        return `${meters}m`;
    }
    return `${Math.round(meters / 100) / 10}km`;
}

export function getSector({x, y}: {x: number, y: number}): {x: number, y: number} {
    return {
        x: Math.floor(x / 100),
        y: Math.floor(y / 100),
    };
}
