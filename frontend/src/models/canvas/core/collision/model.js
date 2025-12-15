export class CollisionSystem {

    constructor() {
        this.enabled = true;
    }

    // ============================================================
    // STEP (Physics-Kollision)
    // ============================================================
    step(entities) {
        if (!this.enabled) return;

        const list = entities.filter(e => e.collision);

        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {

                const a = list[i];
                const b = list[j];

                if (!this._layerMatch(a, b)) continue;

                const ca = a.collision;
                const cb = b.collision;

                const aabbA = ca.getAABB();
                const aabbB = cb.getAABB();
                if (!aabbA || !aabbB) continue;
                if (!this._overlap(aabbA, aabbB)) continue;

                // Trigger only → event, no resolution
                if (ca.isTrigger || cb.isTrigger) {
                    this._trigger(a, b);
                    continue;
                }

                this._resolve(a, b, aabbA, aabbB);
            }
        }
    }

    // ============================================================
    // RAYCAST (zentral)
    // ============================================================
    raycast(ray, entities) {
        const hits = [];

        for (const entity of entities) {
            const col = entity.collision;
            if (!col) continue;

            const dist = col.intersectsRay(ray);
            if (dist === null) continue;

            hits.push({
                entity,
                distance: dist,
                depth: col.getDepth()
            });
        }

        return hits.sort((a, b) => {
            if (a.distance !== b.distance) return a.distance - b.distance;
            return b.depth - a.depth;
        });
    }

    // ============================================================
    // Helpers
    // ============================================================
    _layerMatch(a, b) {
        const ca = a.collision;
        const cb = b.collision;

        return (
            (ca.mask & cb.layer) !== 0 &&
            (cb.mask & ca.layer) !== 0
        );
    }

    _overlap(a, b) {
        return (
            a.min.x <= b.max.x && a.max.x >= b.min.x &&
            a.min.y <= b.max.y && a.max.y >= b.min.y &&
            a.min.z <= b.max.z && a.max.z >= b.min.z
        );
    }

    // ============================================================
    // Trigger
    // ============================================================
    _trigger(a, b) {
        a.onTriggerEnter?.(b);
        b.onTriggerEnter?.(a);
    }

    // ============================================================
    // Resolution
    // ============================================================
    _resolve(a, b, aabbA, aabbB) {

        const pa = a.props.physics;
        const pb = b.props.physics;

        if (!pa && !pb) return;
        if (pa?.mode === "static" && pb?.mode === "static") return;

        const ox = Math.min(aabbA.max.x - aabbB.min.x, aabbB.max.x - aabbA.min.x);
        const oy = Math.min(aabbA.max.y - aabbB.min.y, aabbB.max.y - aabbA.min.y);
        const oz = Math.min(aabbA.max.z - aabbB.min.z, aabbB.max.z - aabbA.min.z);

        let axis = "x";
        let pen = ox;
        if (oy < pen) { axis = "y"; pen = oy; }
        if (oz < pen) { axis = "z"; pen = oz; }

        const dir = a.props[axis] < b.props[axis] ? -1 : 1;

        this._pushback(a, b, axis, pen, dir);
        this._velocityResponse(a, b, axis);
    }

    _pushback(a, b, axis, pen, dir) {
        const pa = a.props.physics;
        const pb = b.props.physics;

        if (pa?.mode === "dynamic" && pb?.mode !== "dynamic") {
            a.props[axis] += pen * dir;
            a.updateMatrix();
            return;
        }

        if (pb?.mode === "dynamic" && pa?.mode !== "dynamic") {
            b.props[axis] -= pen * dir;
            b.updateMatrix();
            return;
        }

        if (pa && pb && pa.mode === "dynamic" && pb.mode === "dynamic") {
            const h = pen * 0.5;
            a.props[axis] += h * dir;
            b.props[axis] -= h * dir;
            a.updateMatrix();
            b.updateMatrix();
        }
    }

    _velocityResponse(a, b, axis) {
        const pa = a.props.physics;
        const pb = b.props.physics;

        if (pa?.mode === "dynamic") pa.velocity[axis] = 0;
        if (pb?.mode === "dynamic") pb.velocity[axis] = 0;
    }
}
