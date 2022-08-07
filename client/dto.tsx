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

export interface WaterTreatmentStatus {
    level: number;
    condition: number;
}

export interface InfirmaryStatus {
    level: number;
}

export interface WorkshopStatus {
    level: number;
}

export interface Crop {
    plantType: string;
}

export interface HorticultureStatus {
    level: number;
    condition: number;
    crops: Crop[];
}

export interface AirRecyclingStatus {
    level: number;
    condition: number;
}

export interface BunkerData {
    reactor: ReactorStatus;
    waterTreatment: WaterTreatmentStatus;
    infirmary: InfirmaryStatus;
    workshop: WorkshopStatus;
    horticulture: HorticultureStatus;
    airRecycling: AirRecyclingStatus;
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

export const assignmentMap = {
    reactor: 'Reactor',
    infirmary: 'Infirmary',
    horticulture: 'Horticulture',
    workshop: 'Workshop',
    waterTreatment: 'Water Treatment',
    maintenance: 'Maintenance',
    cafeteria: 'Cafeteria',
};

export type Assignment = keyof typeof assignmentMap;

export const assignments = Object.keys(assignmentMap) as Assignment[];

export interface Inhabitant {
    id: number;
    bunkerId: number;
    expeditionId?: number;
    name: string;
    dateOfBirth: string;
    skills: Skill[];
    assignment?: Assignment;
    team?: string;
    weaponType?: string;
    ammo: number;
}

export interface ItemType {
    id: string;
    name: string;
    namePlural: string;
    weapon: boolean;
    damage: number;
    range: number;
    ammoType?: string;
}

export interface Item {
    id: number;
    itemType: ItemType;
    quantity: number;
}

export interface Location {
    id: number;
    worldId: number;
    name: string;
    x: number;
    y: number;
    locationType: string;
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

export interface Expedition {
    id: number;
    bunkerId: number;
    locationId?: number;
    zoneX: number;
    zoneY: number;
    eta: string;
    created: string;
    distance: number;
}

export interface TeamMember {
    inhabitantId: number;
    weaponType?: string;
    ammo: number;
}

export interface ExpeditionRequest {
    zoneX: number;
    zoneY: number;
    locationId?: number;
    team: TeamMember[];
}
