export interface User {
    id: number;
    username: string;
    admin: boolean;
}

export interface Credentials {
    username: string;
    password: string;
    remember?: boolean;
}

export interface World {
    id: number;
    name: string;
    players: number;
    open: boolean;
    joined: boolean;
    created: string;
    startYear: number;
    timeAcceleration: number;
    timeOffset: number;
}

export interface World {
    id: number;
    name: string;
    players: number;
    open: boolean;
    joined: boolean;
    created: string;
    startYear: number;
    timeAcceleration: number;
    timeOffset: number;
}

export interface NewWorld {
    name: string;
    open: boolean;
    startYear: number;
    timeAcceleration: number;
    timeOffset: number;
}

export interface ReactorStatus {
    level: number;
    condition: number;
}

export interface BunkerData {
    reactor: ReactorStatus;
}

export interface Bunker {
    id: number;
    userId: number;
    worldId: number;
    number: number;
    x: number;
    y: number;
    data: BunkerData;
}

export interface Skill {
    skillType: string;
    xp: number;
    level: number;
}

export interface InhabitantData {
    skills: Skill[];
}

export interface Inhabitant {
    id: number;
    bunkerId: number;
    expeditionId?: number;
    name: string;
    dateOfBirth: string;
    data: InhabitantData;
}

export interface Item {
    id: number;
    bunkerId: number;
    itemType: string;
    quantity: number;
}

export interface LocationData {
    locationType: string;
    abundance: number;
}

export interface Location {
    id: number;
    worldId: number;
    name: string;
    x: number;
    y: number;
    data: LocationData;
}

export interface Sector {
    x: number;
    y: number;
}

export interface Message {
    id: number;
    receiverBunkerId: number;
    senderBunkerId?: number;
    senderName: string;
    subject: string;
    body: string;
    created: string;
    unread: boolean;
}

export interface ExpeditionData {
}

export interface Expedition {
    id: number;
    bunkerId: number;
    locationId?: number;
    zoneX: number;
    zoneY: number;
    eta: string;
    data: ExpeditionData;
}

export interface ExpeditionRequest {
    zoneX: number;
    zoneY: number;
    locationId?: number;
    team: number[];
}
