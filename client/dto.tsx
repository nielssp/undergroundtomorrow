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


export interface BunkerData {
}

export interface Bunker {
    id: number;
    userId: number;
    world_Id: number;
    number: number;
    x: number;
    y: number;
    data: BunkerData;
}

export interface InhabitantData {
}

export interface Inhabitant {
    id: number;
    bunkerId: number;
    expedition_id?: number;
    name: string;
    dateOfBirth: string;
    data: InhabitantData;
}
