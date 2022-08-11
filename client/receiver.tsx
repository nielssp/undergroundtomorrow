import { Emitter } from "cstk";

export class Receiver {
    private socket?: WebSocket;
    private promise?: Promise<void>;
    private resolve?: (value?: void | PromiseLike<void> | undefined) => void;
    private reject?: (reason?: any) => void;
    active = true;

    readonly onEvent = new Emitter<string>();

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

    get connected(): boolean {
        if (this.socket) {
            return this.socket.readyState === WebSocket.OPEN;
        }
        return false;
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
        if (this.resolve) {
            this.resolve();
        }
    }

    private handleError(event: Event): void {
        console.error('WebSocket error', event);
        if (this.reject) {
            this.reject(event);
        }
    }

    private handleMessage(event: MessageEvent): void {
        this.onEvent.emit(event.data);
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

