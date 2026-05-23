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

export const meshEditEvent = route => {
    const mesh = meshEvent(route);

    return {
        "mesh-edit:state": async payload => toPlain(payload || {}),
        "mesh-edit:update": mesh["mesh-edit:update"],
        "mesh-edit:commit": mesh["mesh-edit:commit"],
        "geometry:update": mesh["geometry:update"],
        "geometry:commit": mesh["geometry:commit"],
    };
};
