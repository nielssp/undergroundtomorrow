/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createElement, Deref, Property, Fragment } from "cstk";
import { ApiError } from "./api";
import { openAlert } from "./dialog";

export function getErrorMessage(error: ApiError|any) {
    if (error.status === 401) {
        return 'You have been logged out';
    } else if (error.status === 403) {
        return 'Not allowed to access resource';
    } else if (error.status === 404) {
        return 'Resource not found';
    } else if (error.status === 400) {
        console.error(error);
        return 'Client error: ' + error.code;
    } else {
        console.error(error);
        return 'Unknown server error';
    }
}

export function handleError(error: ApiError|any) {
    openAlert(getErrorMessage(error));
}

export function ErrorIndicator({error, onRetry}: {
    error: Property<ApiError|any>,
    onRetry?: () => void,
}) {
    return <Deref ref={error}>{error =>
        <div class='stack-row spacing'>
            <div>ERROR</div>
            <div>{error.map(getErrorMessage)}</div>
            {onRetry ? <button onClick={onRetry}>Retry</button> : <></>}
        </div>
    }</Deref>;
}
