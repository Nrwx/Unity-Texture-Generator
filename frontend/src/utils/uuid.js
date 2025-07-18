import { v4 as uuidv4 } from "uuid";

/**
 * Erzeugt eine UUIDv4 mit optionalem Prefix.
 *
 * @param {string} [prefix] - Optionaler String, der der UUID vorangestellt wird.
 * @returns {string} Eindeutige ID (z.B. "user-1b2c3d4e-...")
 */
export function uuid(prefix) {
    const uuid = uuidv4();
    return prefix ? `${prefix}-${uuid}` : uuid;
}