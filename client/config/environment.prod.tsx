import { Environment } from "./environment";

export const environment: Environment = {
    apiUrl: `/api`,
    websocketUrl: `wss://${location.hostname}/api/events`
};

