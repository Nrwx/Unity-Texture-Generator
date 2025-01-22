import { isRef } from "vue";

/**
 * Dynamische Umschaltung für Vue 3.
 * Unterstützt `ref`, `reactive`, und primitive Werte.
 * @param {ref|boolean} ref
 * @param {ref|boolean} val - Der Wert, der geändert werden soll. Kann ein `ref`, ein reaktives Objekt oder ein boolescher Wert sein.
 * @returns {void}
 */
export const toggle = function (ref, val) {
    // Wenn der Wert ein `ref` ist
    if (isRef(ref)) {
        if (isRef(val)) {
            ref.value = !val.value
        } else {
            ref.value = !val
        }
    }

    if (typeof ref === "boolean" && typeof val === "boolean") {
        ref = !val;
    }

    if (typeof val === "object" && val !== null) {
        console.warn("Reactive objects require manual property toggling.");
    }

    throw new Error("Invalid value type. Expected a ref, boolean, or reactive object.");
};
