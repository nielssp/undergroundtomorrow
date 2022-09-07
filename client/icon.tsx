/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const iconFiles = {
    logo: require('./icons/logo.svg'),
    close: require('./icons/close.svg'),
    message: require('./icons/message.svg'),
}
const iconCache: Record<string, Promise<string>> = {};

export type IconName = keyof typeof iconFiles;

async function fetchIcon(name: IconName): Promise<string> {
    if (!iconCache.hasOwnProperty(name)) {
        iconCache[name] = fetch(iconFiles[name]).then(response => {
            if (!response.ok) {
                return Promise.reject(response);
            }
            return response.text();
        });
    }
    return await iconCache[name];
}

export function Icon(props: {
    name: IconName,
    size?: string,
    class?: string,
}) {
    const container = document.createElement('div');
    container.className = 'icon';
    if (props.size) {
        container.style.width = props.size;
        container.style.height = props.size;
    }
    if (props.class) {
        container.className = props.class;
    }
    fetchIcon(props.name).then(icon => container.innerHTML = icon);
    return () => container;
}
