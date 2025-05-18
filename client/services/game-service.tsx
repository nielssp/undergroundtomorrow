/* Copyright (c) 2022 Niels Sonnich Poulsen (http://nielssp.dk)
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { cell, Cell, ref, cellArray, createEmitter, createValue } from "cytoplasmic";
import { addSeconds, differenceInSeconds, differenceInYears, format, formatISO, isSameDay, parseISO, setYear } from "date-fns";
import { Api, ApiContext } from "../api";
import { environment } from "../config/environment";
import { Broadcast, BroadcastEvent, Bunker, Expedition, ExpeditionRequest, Inhabitant, Item, ItemType, Location, Message, RecipeItemType, Sector, World } from "../dto";
import { Receiver } from "../receiver";

function getWorldtime(world: World) {
    const created = parseISO(world.created);
    const duration = differenceInSeconds(new Date(), created);
    const startTime = setYear(created, world.startYear);
    return addSeconds(startTime, duration * world.timeAcceleration + world.timeOffset + new Date().getTimezoneOffset() * 60);
}

export class GameService {
    private clockInterval: number|undefined;
    private messageCheckInterval: number|undefined;
    private itemTypesPromise: Promise<Map<string, ItemType>>|undefined;
    private receiver = ref<Receiver>();
    private eventObserver = (event: BroadcastEvent) => this.handleEvent(event);
    private mostRecentMessage: string|null = null;
    readonly world = ref<World>();
    readonly bunker = ref<Bunker>();
    readonly worldTime = cell(new Date());
    readonly messageNotification = cell(false);
    readonly radioNotification = cell(false);
    readonly expeditionDone = createEmitter<void>();
    readonly transcript = cellArray<Broadcast>();

    constructor(
        private api: Api,
    ) {
        this.world.observe(async world => {
            if (this.clockInterval) {
                clearInterval(this.clockInterval);
                this.clockInterval = undefined;
            }
            if (this.messageCheckInterval) {
                clearInterval(this.messageCheckInterval);
                this.messageCheckInterval = undefined;
            }
            if (world) {
                this.worldTime.value = getWorldtime(world);
                this.clockInterval = window.setInterval(() => {
                    this.worldTime.value = getWorldtime(world);
                }, 1000);
                const unread = await this.hasUnreadMessages();
                if (unread && unread !== this.mostRecentMessage) {
                    this.messageNotification.value = true;
                } else if (!unread) {
                    this.messageNotification.value = false;
                }
                this.mostRecentMessage = unread;
                this.messageCheckInterval = window.setInterval(async () => {
                    const unread = await this.hasUnreadMessages();
                    if (unread && unread !== this.mostRecentMessage) {
                        this.messageNotification.value = true;
                    } else if (!unread) {
                        this.messageNotification.value = false;
                    }
                    this.mostRecentMessage = unread;
                }, 30000);
            }
        });
    }

    get radioConnected() {
        return this.receiver.flatMap(r => r?.connected || cell(false));
    }

    getAge(dob: string): number {
        const date = parseISO(dob);
        return differenceInYears(this.worldTime.value, date);
    }

    bindAge(dob: string): Cell<number> {
        const date = parseISO(dob);
        return this.worldTime.map(wt => differenceInYears(wt, date));
    }

    formatDateTime(iso: string): string {
        const seconds = differenceInSeconds(parseISO(iso), new Date()) * (this.world.value?.timeAcceleration || 1);
        const inGameTime = addSeconds(this.worldTime.value, seconds);
        if (isSameDay(inGameTime, this.worldTime.value)) {
            return format(inGameTime, 'hh:mm a');
        } else {
            return format(inGameTime, 'MM/dd/yyyy');
        }
    }

    private get worldId() {
        if (this.world.value) {
            return this.world.value.id;
        }
        throw new Error('World ID missing'); 
    }

    get itemTypes() {
        if (!this.itemTypesPromise) {
            this.itemTypesPromise = this.getItemTypes().then(itemTypes => {
                const map = new Map<string, ItemType>();
                itemTypes.forEach(itemType => map.set(itemType.id, itemType));
                return map;
            });
            this.itemTypesPromise.catch(() => this.itemTypesPromise = undefined);
        }
        return this.itemTypesPromise;
    }

    get recipes(): Promise<RecipeItemType[]> {
        return this.itemTypes.then(itemTypes => [...itemTypes.values()]
            .filter((i: ItemType): i is RecipeItemType => !!i.recipe));
    }

    async getItemType(id: string): Promise<ItemType|undefined> {
        return (await this.itemTypes).get(id);
    }

    async getItemTypeName(id: string, quantity: number = 1): Promise<string> {
        const itemType = (await this.itemTypes).get(id);
        if (itemType) {
            return quantity === 1 ? itemType.name : itemType.namePlural;
        }
        return id;
    }

    disconnect() {
        this.world.value = undefined;
        if (this.receiver.value) {
            this.receiver.value.disconnect();
            this.receiver.value.onEvent.unobserve(this.eventObserver);
            this.receiver.value = undefined;
        }
    }

    async selectWorld(worldId: number) {
        if (this.world.value?.id === worldId) {
            return;
        }
        this.disconnect();
        this.world.value = await this.getWorld(worldId);
        try {
            this.bunker.value = await this.getBunker();
            this.receiver.value = new Receiver(`${environment.websocketUrl}?broadcast_id=${encodeURIComponent(this.bunker.value.broadcastId)}`);
            this.receiver.value.onEvent.observe(this.eventObserver);
        } catch (error) {
            this.world.value = undefined;
            throw error;
        }
    }

    private handleEvent(event: BroadcastEvent) {
        try {
            switch (event) {
                case 'Tick':
                    this.refreshBunker();
                    break;
                case 'Expedition':
                    this.expeditionDone.emit();
                    break;
                case 'Message':
                    this.messageNotification.value = true;
                    break;
                default:
                    if (event.Broadcast) {
                        this.transcript.push(event.Broadcast);
                        this.radioNotification.value = true;
                        setTimeout(() => this.radioNotification.value = false, 1000);
                    }
                    break;
            }
        } catch (error: unknown) {
            console.error('Error in event handler', error);
        }
    }

    async refreshBunker() {
        this.bunker.value = await this.getBunker();
    }

    getWorld(worldId: number) {
        return this.api.rpc<World>(`world/${worldId}/get_world`);
    }

    getItemTypes() {
        return this.api.rpc<ItemType[]>(`world/${this.worldId}/get_item_types`);
    }

    getBunker() {
        return this.api.rpc<Bunker>(`world/${this.worldId}/get_bunker`);
    }

    getInhabitants() {
        return this.api.rpc<Inhabitant[]>(`world/${this.worldId}/get_inhabitants`);
    }

    setTeam(inhabitantId: number, team: string|undefined) {
        return this.api.rpc<void>(`world/${this.worldId}/set_team`, {inhabitantId, team});
    }

    setAssignment(inhabitantId: number, assignment: string|undefined) {
        return this.api.rpc<void>(`world/${this.worldId}/set_assignment`, {inhabitantId, assignment});
    }

    getItems() {
        return this.api.rpc<Item[]>(`world/${this.worldId}/get_items`);
    }

    getLocations() {
        return this.api.rpc<Location[]>(`world/${this.worldId}/get_locations`);
    }

    getSectors() {
        return this.api.rpc<Sector[]>(`world/${this.worldId}/get_sectors`);
    }

    getMessages(olderThan?: Date) {
        // TODO: query-object for rpc method
        return this.api.rpc<Message[]>(`world/${this.worldId}/get_messages${olderThan ? '?older_than=' + formatISO(olderThan) : ''}`);
    }

    setMessageRead(messageId: number) {
        return this.api.rpc<void>(`world/${this.worldId}/set_message_read`, messageId);
    }

    setAllMessagesRead() {
        return this.api.rpc<void>(`world/${this.worldId}/set_all_messages_read`);
    }

    hasUnreadMessages() {
        return this.api.rpc<string|null>(`world/${this.worldId}/has_unread_messages`);
    }

    getExpeditions() {
        return this.api.rpc<Expedition[]>(`world/${this.worldId}/get_expeditions`);
    }

    createExpedition(expeditionRequest: ExpeditionRequest) {
        return this.api.rpc<void>(`world/${this.worldId}/create_expedition`, expeditionRequest);
    }

    refuelReactor(itemType: string) {
        return this.api.rpc<void>(`world/${this.worldId}/refuel_reactor`, {itemType});
    }

    updateInfirmaryInventory(medicine: number) {
        return this.api.rpc<void>(`world/${this.worldId}/update_infirmary_inventory`, {medicine});
    }

    addCrop(seedType: string, amount: number) {
        return this.api.rpc<void>(`world/${this.worldId}/add_crop`, {seedType, amount});
    }

    removeCrop(index: number) {
        return this.api.rpc<void>(`world/${this.worldId}/remove_crop`, {index});
    }

    addProject(itemType: string, quantity: number) {
        return this.api.rpc<void>(`world/${this.worldId}/add_project`, {itemType, quantity});
    }

    removeProject(index: number) {
        return this.api.rpc<void>(`world/${this.worldId}/remove_project`, {index});
    }

    prioritizeProject(index: number) {
        return this.api.rpc<void>(`world/${this.worldId}/prioritize_project`, {index});
    }

    broadcast(message: string) {
        return this.api.rpc<void>(`world/${this.worldId}/broadcast`, message);
    }

    async restart() {
        const worldId = this.worldId;
        await this.api.rpc<void>(`world/${worldId}/leave`);
        await this.api.rpc<void>('lobby/join_world', {worldId});
        await this.selectWorld(worldId);
    }
}

export const GameServiceContext = createValue(new GameService(ApiContext.defaultValue));
