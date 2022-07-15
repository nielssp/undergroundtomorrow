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
