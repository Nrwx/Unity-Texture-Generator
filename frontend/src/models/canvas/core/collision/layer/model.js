export class Collision {

    constructor(entity,  options = {}) {
        this.entity = entity;

        // Trigger / Sensor
        this.isTrigger = options.isTrigger ?? false;

        // Layer / Mask (Bitmask)
        this.layer = options.layer ?? 0b0001;
        this.mask  = options.mask  ?? 0b1111;
    }

    // ============================================================
    // Unified AABB (2D oder 3D, je nach TYPE)
    // ============================================================
    getAABB() {
        const e = this.entity;

        switch (e.type) {

            // ----------------------------------------------------
            // 3D MESH → Geometry Bounds
            // ----------------------------------------------------
            case "mesh": {
                const geom = e.props.geometry;
                if (!geom?.bounds) return null;

                const { min, max } = geom.bounds;
                const {
                    x, y, z,
                    scaleX, scaleY, scaleZ
                } = e.props;

                return {
                    min: {
                        x: min.x * scaleX + x,
                        y: min.y * scaleY + y,
                        z: min.z * scaleZ + z
                    },
                    max: {
                        x: max.x * scaleX + x,
                        y: max.y * scaleY + y,
                        z: max.z * scaleZ + z
                    }
                };
            }

            // ----------------------------------------------------
            // 2D TYPES → Rect
            // ----------------------------------------------------
            case "texture":
            case "object":
            case "effect":
            case "tree":
            default: {
                const { x, y, width, height } = e.props;
                return {
                    min: { x, y, z: 0 },
                    max: { x: x + width, y: y + height, z: 0 }
                };
            }
        }
    }

    // ============================================================
    // 2D Hit Test (Pointer, UI, Editor)
    // ============================================================
    hitTest(px, py) {
        const aabb = this.getAABB();
        if (!aabb) return false;

        // Nur sinnvoll für 2D-Objekte
        if (this.entity.type === "mesh") return false;

        return (
            px >= aabb.min.x &&
            px <= aabb.max.x &&
            py >= aabb.min.y &&
            py <= aabb.max.y
        );
    }

    // ============================================================
    // Ray Intersection (2D oder 3D)
    // ============================================================
    intersectsRay(ray) {
        const aabb = this.getAABB();
        if (!aabb) return null;

        const { origin, dir } = ray;

        let tmin = -Infinity;
        let tmax = Infinity;

        for (const axis of ["x", "y", "z"]) {
            if (dir[axis] === 0) continue;
            const t1 = (aabb.min[axis] - origin[axis]) / dir[axis];
            const t2 = (aabb.max[axis] - origin[axis]) / dir[axis];

            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        }

        if (tmax >= Math.max(0, tmin)) {
            return tmin >= 0 ? tmin : tmax;
        }

        return null;
    }

    // ============================================================
    // Render / Pick Order
    // ============================================================
    getDepth() {
        const e = this.entity;

        // Meshes → Z depth
        if (e.type === "mesh") {
            return e.props.z;
        }

        // 2D → zIndex fallback
        return e.props.zIndex ?? e.props.y ?? 0;
    }
}
