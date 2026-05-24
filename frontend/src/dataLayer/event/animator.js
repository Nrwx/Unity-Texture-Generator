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

export const animatorEvent = () => ({
    "editor:pick": async payload => toPlain(payload || {}),
    "editor:pick-clear": async payload => toPlain(payload || {}),
});
