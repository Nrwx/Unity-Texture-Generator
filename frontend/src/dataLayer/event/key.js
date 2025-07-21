import dayjs from "dayjs";

export const keyEvent = (route) => ({
    "apply-key-normalize": async (payload) => {
        const modifiers = [];
        if (payload.ctrlKey) modifiers.push("Control");
        if (payload.altKey) modifiers.push("Alt");
        if (payload.metaKey) modifiers.push("Meta");
        if (payload.shiftKey) modifiers.push("Shift");

        const key = payload.key === " " ? "Space" : payload.key;

        if (['Control', 'Alt', 'Meta', 'Shift'].includes(key)) {
            return `${key}`;
        }

        return modifiers.length ? `${modifiers.join(" + ")} + ${key}` : key;
    },
    "apply-key-down": async (payload) => {
        const timestamp = dayjs().valueOf();
        const keyName = await keyEvent(route)["apply-key-normalize"](payload);

        // Schon gedrückt? -> ignorieren
        if (route.tempData.heldKeys.value.has(keyName)) return;

        // Neuen Eintrag erstellen
        const keyEntry = {
            id: timestamp,
            name: keyName,
            held: true,
        };

        // In heldKeys merken (für keyup)
        route.tempData.heldKeys.value.set(keyName, keyEntry);

        const existingIndex = route.tempData.keys.value.findIndex(entry => entry.name === keyName);
        if (existingIndex !== -1) {
            route.tempData.keys.value.splice(existingIndex, 1);
        }

        route.tempData.keys.value.push(keyEntry);

        // Auf max. 8 Elemente kürzen
        if (route.tempData.keys.value.length > 8) {
            route.tempData.keys.value.shift();
        }
    },

    "apply-key-up": async (payload) => {
        const comboKey = await keyEvent(route)["apply-key-normalize"](payload);

        // HeldKeys aktualisieren
        const entry = route.tempData.heldKeys.value.get(comboKey);
        if (entry) {
            entry.held = false;
            route.tempData.heldKeys.value.delete(comboKey);
        }

        // Auch in der Anzeige-Liste das passende Objekt finden und auf held=false setzen
        const target = route.tempData.keys.value.find(e => e.name === comboKey);
        if (target) {
            target.held = false;
        }

    },

})