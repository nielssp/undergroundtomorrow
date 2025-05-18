/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ariaBool, Cell, Context, createElement, createRouter, Fragment, Link } from 'cytoplasmic';
import { Status } from './status';
import { People } from './people';
import { Items } from './items';
import { Radio } from './radio';
import { Map } from './map';
import { GameServiceContext } from './services/game-service';
import { User } from './dto';
import { Icon } from './icon';
import { Messages } from './messages';

export function Game({user, amber}: {
    user: Cell<User>,
    amber: Cell<boolean>,
}, context: Context) {
    const gameService = context.use(GameServiceContext);

    const router = createRouter({
        'status': () => <Status user={user}/>,
        'people': () => <People/>,
        'items': () => <Items/>,
        'map': () => <Map amber={amber}/>,
        'radio': () => <Radio/>,
        'messages': () => <Messages/>,
        '**': () => <div class='stack-row spacing'>
            <div>
                Not found
            </div>
            <Link path='status'>
                <a>Return</a>
            </Link>
        </div>,
    });

    const tab = router.activeRoute.map(r => r?.path[0]);

    return <>
        <menu role='tablist'>
            <li><button onClick={() => router.navigate('status')} aria-selected={ariaBool(tab.eq('status'))}>Status</button></li>
            <li><button onClick={() => router.navigate('people')} aria-selected={ariaBool(tab.eq('people'))}>People</button></li>
            <li><button onClick={() => router.navigate('items')} aria-selected={ariaBool(tab.eq('items'))}>Items</button></li>
            <li><button onClick={() => router.navigate('map')} aria-selected={ariaBool(tab.eq('map'))}>Map</button></li>
            <li><button onClick={() => router.navigate('radio')} aria-selected={ariaBool(tab.eq('radio'))} class={{attention: gameService.radioNotification}}>Radio</button></li>
            <li><button onClick={() => router.navigate('messages')} aria-selected={ariaBool(tab.eq('messages'))} class={{attention: gameService.messageNotification}}><Icon name='message'/></button></li>
        </menu>
        <div class='stack-column grow' style='overflow-y: auto;'>
            <router.Portal/>
        </div>
    </>;
}

