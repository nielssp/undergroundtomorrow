/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Property, Show, createElement, bind, zipWith, Deref, Fragment, ValueProperty, For, ariaBool } from "cstk";
import { differenceInSeconds, parseISO } from "date-fns";
import { Item, ItemType } from "./dto";
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
    readonly loading: Property<boolean> = zipWith([this.data, this.error], (d, e) => typeof d === 'undefined' && !e);
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
    return getItemTypeNameAndQuantity(item.itemType, item.quantity);
}

export function getItemTypeNameAndQuantity(itemType: ItemType, quantity: number) {
    if (quantity === 1) {
        return itemType.name;
    }
    return `${itemType.namePlural} (${quantity})`;
}

export function QuantityButtons({value, max}: {
    value: ValueProperty<number>,
    max: Property<number>,
}) {
    return <div class='stack-row spacing justify-space-between'>
        <button disabled={value.map(a => a <= 0)} onClick={() => value.value = Math.max(0, value.value - 10)}>-10</button>
        <button disabled={value.map(a => a <= 0)} onClick={() => value.value--}>-1</button>
        <button disabled={zipWith([value, max], (v, m) => v >= m)} onClick={() => value.value++}>+1</button>
        <button disabled={zipWith([value, max], (v, m) => v >= m)} onClick={() => value.value = Math.min(max.value, value.value + 10)}>+10</button>
    </div>;
}

export function Select<T>({selection, options, toString, close}: {
    selection: T,
    options: T[],
    toString: (option: T) => string,
    close: (selection: T) => void,
}) {
    return <div class='stack-column padding'>
        <div role='grid' class='stack-column'>
            <For each={bind(options)}>{item =>
                <button role='row' class='selectable' aria-selected={ariaBool(item.eq(selection))} onClick={() => close(item.value)}>
                    <div role='gridcell' class='stack-row spacing'>
                        <div>{item.map(toString)}</div>
                    </div>
                </button>
                }</For>
        </div>
    </div>;
}

export function applyFilter<T>(list: Property<T[]>, filter: Property<{apply: (item: T) => boolean}>): Property<T[]> {
    return zipWith([list, filter], (l, f) => {
        return l.filter(f.apply);
    });
}
