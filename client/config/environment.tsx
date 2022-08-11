const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
export const environment = {
    apiUrl: `${location.origin}/api`,
    websocketUrl: `${wsProtocol}://${location.hostname}:4014/events`
};

export type Environment = typeof environment;
