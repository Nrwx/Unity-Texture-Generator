export class Collision {
    /**
     * options:
     *  - type: "aabb" | "box" | "mesh" | "capsule" | "sphere" | "plane"
     *  - isTrigger: boolean
     *  - layer, mask: bitmasks
     *  - radius, height: capsule/sphere params
     */
     constructor(entity, options = {}) {
        this.entity = entity;

        this.type = options.type ?? "aabb";
        this.isTrigger = options.isTrigger ?? false;

        // Layer / Mask (Bitmask)
        this.layer = options.layer ?? 0b0001;
        this.mask  = options.mask  ?? 0b1111;

        // shape params (capsule/sphere)
        this.radius = options.radius ?? 0.5;
        this.height = options.height ?? 1.8;

        // plane thickness fallback for 'plane' type
        this.thickness = options.thickness ?? 0.06;
    }

    // -------------------------
    // Public helper: collision layer compatibility
    // -------------------------
    canCollideWith(other) {
        if (!other) return false;
        return ((this.mask & other.layer) !== 0) && ((other.mask & this.layer) !== 0);
    }

    // ============================================================
    // Unified AABB (2D oder 3D, je nach TYPE)
    // ============================================================
    getAABB() {
        const e = this.entity;

        // 3D world
        if (e._state.world === '3d') {
            // Delegiere je nach Shape-Type
            switch (this.type) {
                case "capsule":
                    return this._aabbFromCapsule();
                case "sphere":
                    return this._aabbFromSphere();
                case "box":
                case "aabb":
                    return this._aabbFromGeometry();
                case "mesh":
                    return this._aabbFromGeometry();
                case "plane":
                    return this._aabbFromPlane();
                default:
                    return this._aabbFromGeometry();
            }
        }

        // 2D fallback (UI / Editor)
        const { x = 0, y = 0, width = 0, height = 0 } = e.props ?? {};
        return {
            min: { x, y, z: 0 },
            max: { x: x + width, y: y + height, z: 0 }
        };
    }

    // -------------------------
    // Capsule AABB
    // -------------------------
    _aabbFromCapsule() {
        const e = this.entity;
        // assume position center is at feet-mid? use position vector
        const p = e.position?.data ?? [e.props.x ?? 0, e.props.y ?? 0, e.props.z ?? 0];
        const s = e.scale?.data ?? [1,1,1];

        // capsule axis along Y (height)
        const r = this.radius * (s[0] + s[2]) * 0.5; // scale radius by X/Z
        const halfH = (this.height * s[1]) * 0.5;

        return {
            min: { x: p[0] - r, y: p[1] - halfH, z: p[2] - r },
            max: { x: p[0] + r, y: p[1] + halfH, z: p[2] + r }
        };
    }

    // -------------------------
    // Sphere AABB
    // -------------------------
    _aabbFromSphere() {
        const e = this.entity;
        const p = e.position?.data ?? [e.props.x ?? 0, e.props.y ?? 0, e.props.z ?? 0];
        const s = e.scale?.data ?? [1,1,1];
        const r = this.radius * Math.max(s[0], s[1], s[2]);
        return {
            min: { x: p[0] - r, y: p[1] - r, z: p[2] - r },
            max: { x: p[0] + r, y: p[1] + r, z: p[2] + r }
        };
    }

    // -------------------------
    // Geometry-based AABB (box, mesh, aabb)
    // uses geometry.bounds or entity.bounds (World.update sets bounds)
    // -------------------------
    _aabbFromGeometry() {
        const e = this.entity;
        const geom = e.geometry;
        // prefer geometry.bounds (local), then entity.bounds (already world space), else null
        if (geom?.bounds) {
            const { min, max } = geom.bounds;
            const p = e.position?.data ?? [e.props.x ?? 0, e.props.y ?? 0, e.props.z ?? 0];
            const s = e.scale?.data ?? [1,1,1];
            return {
                min: { x: min[0]*s[0] + p[0], y: min[1]*s[1] + p[1], z: min[2]*s[2] + p[2] },
                max: { x: max[0]*s[0] + p[0], y: max[1]*s[1] + p[1], z: max[2]*s[2] + p[2] }
            };
        }

        // fallback to entity.bounds (already updated by updateBounds())
        if (e.bounds) {
            return {
                min: { x: e.bounds.min[0], y: e.bounds.min[1], z: e.bounds.min[2] },
                max: { x: e.bounds.max[0], y: e.bounds.max[1], z: e.bounds.max[2] }
            };
        }

        return null;
    }

    // -------------------------
    // Plane AABB (thin box centered at plane y)
    // -------------------------
    _aabbFromPlane() {
        const e = this.entity;
        // planes in your terrain are likely centered on Y=plane.y and use width/height props
        const px = e.props.x ?? (e.position?.data?.[0] ?? 0);
        const py = e.props.y ?? (e.position?.data?.[1] ?? 0);
        const pz = e.props.z ?? (e.position?.data?.[2] ?? 0);
        const width = e.props.width ?? (e.props.w ?? 1);
        const depth = e.props.height ?? (e.props.h ?? 1);
        const thickness = this.thickness;

        const hw = width * 0.5;
        const hd = depth * 0.5;
        return {
            min: { x: px - hw, y: py - thickness, z: pz - hd },
            max: { x: px + hw, y: py + thickness, z: pz + hd }
        };
    }

    // ============================================================
    // Ray Intersection -> default to AABB ray test; override if mesh has own fast method
    // ============================================================
    intersectsRay(ray) {
        const aabb = this.getAABB();
        if (!aabb) return null;

        const { origin, dir } = ray;

        let tmin = -Infinity;
        let tmax = Infinity;

        for (const axis of ["x","y","z"]) {
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
    // Depth for pick ordering
    // ============================================================
    getDepth() {
        const e = this.entity;
        if (e.type === "mesh") return e.props.z ?? 0;
        return e.props.zIndex ?? e.props.y ?? 0;
    }
}
