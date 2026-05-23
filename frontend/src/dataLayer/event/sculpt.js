import { meshEvent } from "./mesh";

const toPlain = value => {
    if (value === null || value === undefined) {
        return value;
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return value;
    }
};

export const sculptEvent = route => {
    const mesh = meshEvent(route);

    return {
        "sculpt:brush": async payload => toPlain(payload || {}),
        "sculpt:update": mesh["sculpt:update"],
        "sculpt:commit": mesh["sculpt:commit"],
    };
};
