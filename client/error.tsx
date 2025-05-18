/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createElement, Deref, Cell, cell } from 'cytoplasmic';
import { ApiError } from './api';
import { openAlert } from './dialog';

export function getErrorMessage(error: unknown) {
    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
        if (error.status === 401) {
            return 'You have been logged out';
        } else if (error.status === 403) {
            return 'Not allowed to access resource';
        } else if (error.status === 404) {
            return 'Resource not found';
        } else if (error.status === 400 && 'code' in error && typeof error.code === 'string') {
            console.error(error);
            return 'Client error: ' + error.code;
        }
    }
    console.error(error);
    return 'Unknown server error';
}

export function handleError(error: unknown) {
    openAlert(getErrorMessage(error));
}

export function ErrorIndicator({error, onRetry}: {
    error: Cell<ApiError|any>,
    onRetry?: () => void,
}) {
    return <Deref ref={error}>{error =>
        <div class='stack-row spacing'>
            <div>ERROR</div>
            <div>{error.map(getErrorMessage)}</div>
            <Deref ref={cell(onRetry)}>{onRetry =>
                <button onClick={onRetry.value}>Retry</button>
            }</Deref>
        </div>
    }</Deref>;
}
