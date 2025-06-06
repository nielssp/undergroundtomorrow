/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createValue } from 'cytoplasmic';
import { environment } from './config/environment';

export interface ApiError {
    status: number;
    statusText: string;
    code: string;
}

export class Api {
    constructor(private baseUrl: string) {
    }

    async handleError(response: Response) {
        if (response.ok) {
            return;
        }
        let body: string;
        try {
            body = await response.json();
            if (typeof body !== 'string') {
                body = 'UNKNOWN_ERROR';
            }
        } catch (error) {
            console.error('Error decoding error', error);
            throw {
                status: response.status,
                statusText: response.statusText,
                code: 'CONNECTION_ERROR'
            };
        }
        throw {
            status: response.status,
            statusText: response.statusText,
            code: body
        };
    }

    async rpc<T>(path: string, data: object|string|number|boolean = {}): Promise<T> {
        const url = `${this.baseUrl}/${path}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Underground-Tomorrow': '1'
            },
            body: JSON.stringify(data),
        });
        await this.handleError(response);
        if (response.status === 204) {
            return undefined as any;
        }
        return response.json();
    }
}

export const ApiContext = createValue(new Api(environment.apiUrl));
