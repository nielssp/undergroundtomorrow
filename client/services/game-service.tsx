import {bind, ref} from "cstk";
import {addSeconds, differenceInCalendarYears, differenceInSeconds, formatISO, parseISO, setYear} from "date-fns";
import {Api} from "../api";
import {Bunker, Expedition, ExpeditionRequest, Inhabitant, Item, Location, Message, World} from "../dto";
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
    readonly world = ref<World>();
    readonly bunker = ref<Bunker>();
    readonly worldTime = bind(new Date());

    constructor(
        private api: Api,
    ) {
        this.world.observe(world => {
            if (this.clockInterval) {
                clearInterval(this.clockInterval);
                this.clockInterval = undefined;
            }
            if (world) {
                this.worldTime.value = getWorldtime(world);
                this.clockInterval = window.setInterval(() => {
                    this.worldTime.value = getWorldtime(world);
                }, 1000);
            }
        });
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

    getItems() {
        return this.api.rpc<Item[]>(`world/${this.worldId}/get_items`);
    }

    getLocations() {
        return this.api.rpc<Location[]>(`world/${this.worldId}/get_locations`);
    }

    getMessages(olderThan?: Date) {
        // TODO: query-object for rpc method
        return this.api.rpc<Message[]>(`world/${this.worldId}/get_messages${olderThan ? '?older_than=' + formatISO(olderThan) : ''}`);
    }

    setMessageRead(messageId: number) {
        return this.api.rpc<void>(`world/${this.worldId}/set_message_read`, messageId);
    }

    getExpeditions() {
        return this.api.rpc<Expedition[]>(`world/${this.worldId}/get_expeditions`);
    }

    createExpedition(expeditionRequest: ExpeditionRequest) {
        return this.api.rpc<void>(`world/${this.worldId}/create_expedition`, expeditionRequest);
    }
}
