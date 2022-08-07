import {bind, Property, ref, zipWith} from "cstk";
import {addSeconds, differenceInCalendarYears, differenceInSeconds, differenceInYears, formatISO, parseISO, setYear} from "date-fns";
import {Api} from "../api";
import {Bunker, Expedition, ExpeditionRequest, Inhabitant, Item, Location, Message, Sector, World} from "../dto";
/*
    let duration = Utc::now().signed_duration_since(world.created);
    let date = NaiveDate::from_yo(world.start_year, world.created.ordinal());
    let start_time = NaiveDateTime::new(date, world.created.naive_utc().time());
    start_time + duration * world.time_acceleration + Duration::seconds(world.time_offset as i64)
 */

function getWorldtime(world: World) {
    const created = parseISO(world.created);
    const duration = differenceInSeconds(new Date(), created);
    const startTime = setYear(created, world.startYear);
    return addSeconds(startTime, duration * world.timeAcceleration + world.timeOffset + new Date().getTimezoneOffset() * 60);
}

export class GameService {
    private clockInterval: number|undefined;
    private messageCheckInterval: number|undefined;
    readonly world = ref<World>();
    readonly bunker = ref<Bunker>();
    readonly worldTime = bind(new Date());
    readonly messageNotification = bind(false);

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
                this.messageNotification.value = await this.hasUnreadMessages();
                this.messageCheckInterval = window.setInterval(async () => {
                    this.messageNotification.value = await this.hasUnreadMessages();
                }, 30000);
            }
        });
    }

    getAge(dob: string): Property<number> {
        const date = parseISO(dob);
        return this.worldTime.map(wt => differenceInYears(wt, date));
    }

    private get worldId() {
        if (this.world.value) {
            return this.world.value.id;
        }
        throw new Error('World ID missing'); 
    }

    async selectWorld(worldId: number) {
        this.world.value = await this.getWorld(worldId);
        try {
            this.bunker.value = await this.getBunker();
        } catch (error) {
            this.world.value = undefined;
            throw error;
        }
    }

    getWorld(worldId: number) {
        return this.api.rpc<World>(`world/${worldId}/get_world`);
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

    hasUnreadMessages() {
        return this.api.rpc<boolean>(`world/${this.worldId}/has_unread_messages`);
    }

    getExpeditions() {
        return this.api.rpc<Expedition[]>(`world/${this.worldId}/get_expeditions`);
    }

    createExpedition(expeditionRequest: ExpeditionRequest) {
        return this.api.rpc<void>(`world/${this.worldId}/create_expedition`, expeditionRequest);
    }
}
