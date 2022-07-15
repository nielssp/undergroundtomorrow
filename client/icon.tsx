const iconFiles = {
    logo: require('./icons/logo.svg'),
    close: require('./icons/close.svg'),
}
const iconCache: Record<string, Promise<string>> = {};

export type IconName = keyof typeof iconFiles;

async function fetchIcon(name: IconName): Promise<string> {
    if (!iconCache.hasOwnProperty(name)) {
        iconCache[name] = fetch(iconFiles[name]).then(response => {
            if (!response.ok) {
                return Promise.reject(response);
            }
            return response.text();
        });
    }
    return await iconCache[name];
}

export function Icon(props: {
    name: IconName,
    size?: string,
    class?: string,
}) {
    const container = document.createElement('div');
    container.className = 'icon';
    if (props.size) {
        container.style.width = props.size;
        container.style.height = props.size;
    }
    if (props.class) {
        container.className = props.class;
    }
    fetchIcon(props.name).then(icon => container.innerHTML = icon);
    return () => container;
}
