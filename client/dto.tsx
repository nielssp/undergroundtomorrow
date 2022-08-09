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
    maintenance: number;
    fuel: number;
    malfunction: boolean;
}

export interface WaterTreatmentStatus {
    maintenance: number;
    malfunction: boolean;
}

export interface InfirmaryStatus {
    medicine: number;
}

export interface WorkshopProject {
    itemType: string;
    quantity: number;
    progress: number;
    max: number;
    produced: number;
}

export interface WorkshopStatus {
    projects: WorkshopProject[];
}

export interface Crop {
    seedType: string;
    name: string;
    quantity: number;
    stage: number;
    max: number;
    stunted: boolean;
}

export interface HorticultureStatus {
    crops: Crop[];
}

export interface AirRecyclingStatus {
    maintenance: number;
    malfunction: boolean;
}

export interface Bunker {
    id: number;
    number: number;
    x: number;
    y: number;
    reactor: ReactorStatus;
    waterTreatment: WaterTreatmentStatus;
    infirmary: InfirmaryStatus;
    workshop: WorkshopStatus;
    horticulture: HorticultureStatus;
    airRecycling: AirRecyclingStatus;
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
    airRecycling: 'Air Recycling',
    maintenance: 'Maintenance',
    cafeteria: 'Cafeteria',
};

export type Assignment = keyof typeof assignmentMap;

export const assignments = Object.keys(assignmentMap) as Assignment[];

export interface Inhabitant {
    id: number;
    expeditionId?: number;
    name: string;
    dateOfBirth: string;
    skills: Skill[];
    assignment?: Assignment;
    team?: string;
    weaponType?: string;
    ammo: number;
    bleeding: boolean;
    wounded: boolean;
    sick: boolean;
    infection: boolean;
    recovering: boolean;
    ready: boolean;
}

export interface CraftingRecipe {
    minLevel: number;
    time: number;
    ingredients: Record<string, number>,
}

export interface ItemType {
    id: string;
    name: string;
    namePlural: string;
    weapon: boolean;
    damage: number;
    range: number;
    ammoType?: string;
    reactivity: number;
    seed: boolean;
    growthTime: number;
    produce?: string;
    recipe?: CraftingRecipe;
}

export type RecipeItemType = ItemType & {recipe: CraftingRecipe};

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
