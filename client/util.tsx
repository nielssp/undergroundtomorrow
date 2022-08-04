import {Property, Show, createElement, bind, zipWith, Deref, Fragment} from "cstk";
import { differenceInSeconds, parseISO } from "date-fns";
import { Item } from "./dto";
import { ErrorIndicator } from "./error";

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

export function formatDuration(seconds: number) {
    let result = '';
    if (seconds < 0) {
        seconds *= -1;
        result = '-';
    }
    if (seconds >= 86400) {
        result += `${Math.floor(seconds / 86400)}d `;
    }
    result += `${Math.floor((seconds % 86400) / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    return result;
}

export function formatEta(date: string) {
    return formatDuration(differenceInSeconds(parseISO(date), new Date()));
}

export function getSector({x, y}: {x: number, y: number}): {x: number, y: number} {
    return {
        x: Math.floor(x / 100),
        y: Math.floor(y / 100),
    };
}

export class DataSource<T> {
    private readonly promise = bind(this.source());
    readonly data: Property<T|undefined> = this.promise.await(error => this._error.value = error);
    private readonly _error = bind<any>(undefined);
    readonly loading: Property<boolean> = zipWith([this.data, this.error], (d, e) => !d && !e);
    constructor(
        private source: () => Promise<T>,
    ) {
    }

    get error(): Property<any> {
        return this._error;
    }

    async refresh() {
        this._error.value = undefined;
        this.promise.value = this.source();
        await this.promise.value;
    }

    notify() {
        this.promise.value = this.promise.value;
    }
}

export function dataSource<T>(source: () => Promise<T>): DataSource<T> {
    return new DataSource(source);
}

export function DerefData<T>({data, children}: {
    data: DataSource<T>,
    children: (data: Property<T>) => JSX.Element,
}) {
    return <>
        <LoadingIndicator loading={data.loading}/>
        <ErrorIndicator error={data.error} onRetry={() => data.refresh()}/>
        <Deref ref={data.data}>{children}</Deref>
    </>;
}

export function getItemName(item: Item) {
    if (item.quantity === 1) {
        return item.itemType.name;
    }
    return item.itemType.namePlural;
}
