export class PhysicsSystem {

    constructor() {
        this.enabled = true;
    }

    /**
     * @param {number} dt
     * @param {Entity[]} entities
     */
    step(dt, entities) {
        if (!this.enabled) return;

        for (const entity of entities) {
            const physics = entity.props?.physics;
            if (!physics) continue;

            physics.integrate(dt, entity);
        }
    }

    stop(entity) {
        entity?.props?.physics?.stop();
    }

    stopAll(entities) {
        for (const e of entities) {
            e.props?.physics?.stop();
        }
    }
}
