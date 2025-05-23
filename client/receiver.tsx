/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { cell, createEmitter } from "cytoplasmic";
import { BroadcastEvent } from "./dto";

export class Receiver {
    private socket?: WebSocket;
    private promise?: Promise<void>;
    private resolve?: (value?: void | PromiseLike<void> | undefined) => void;
    private reject?: (reason?: any) => void;
    active = true;

    readonly onEvent = createEmitter<BroadcastEvent>();
    readonly connected = cell(false);

    reconnectTimeout?: number;

    constructor(
        private url: string,
    ) {
        this.connect();
    }

    cancelReconnect() {
        if (this.reconnectTimeout) {
            window.clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = undefined;
        }
    }

    connect() {
        if (this.socket) {
            return Promise.resolve();
        }
        if (!this.promise) {
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
            });
            console.log(`Connecting to ${this.url}`);
            this.socket = new WebSocket(this.url);
            this.socket.binaryType = 'arraybuffer';
            this.socket.onmessage = event => this.handleMessage(event);
            this.socket.onerror = event => this.handleError(event);
            this.socket.onopen = () => this.handleOpen();
            this.socket.onclose = () => this.handleClose();
        }
        return this.promise;
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = undefined;
        }
        this.active = false;
    }

    private handleClose(): void {
        console.log('WebSocket closed');
        this.socket = undefined;
        this.promise = undefined;
        this.connected.value = false;
        if (this.active) {
            if (!this.reconnectTimeout) {
                console.log('Disconnected, attempting to reconnect...');
                this.reconnectTimeout = window.setTimeout(() => this.reconnect(), 5000);
            }
        } else {
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }
        }
    }

    private async handleOpen(): Promise<void> {
        console.log('WebSocket opened');
        this.connected.value = true;
        if (this.resolve) {
            this.resolve();
        }
    }

    private handleError(event: Event): void {
        console.error('WebSocket error', event);
        this.connected.value = false;
        if (this.reject) {
            this.reject(event);
        }
    }

    private handleMessage(event: MessageEvent): void {
        this.onEvent.emit(JSON.parse(event.data));
    }


    private async reconnect() {
        this.reconnectTimeout = undefined;
        if (!this.active) {
            return;
        }
        try {
            await this.connect();
        } catch (error) {
            if (!this.reconnectTimeout) {
                console.log('Could not connect to server. Retrying...');
                this.reconnectTimeout = window.setTimeout(() => this.reconnect(), 5000);
            }
        }
    }
}

