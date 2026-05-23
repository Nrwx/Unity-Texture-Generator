// CollisionSystem (replace your old file with this)
export class CollisionSystem {

    constructor() {
        this.enabled = true;
    }

    // ============================================================
    // STEP (Physics-Kollision)  -- Broadphase kept
    // ============================================================
    step(entities) {
        if (!this.enabled) return;

        const list = entities.filter(e => e.collision);

        // optional: store prevY for one-sided checks (if not set elsewhere)
        for (const e of list) {
            e._prevY = Number(e._prevY ?? e.props?.y ?? e.position?.data?.[1] ?? 0);
        }

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

                // === Narrowphase dispatch ===
                this._resolve(a, b, aabbA, aabbB);
            }
        }
    }

    // ============================================================
    // RAYCAST (zentral) - unchanged except small robustness
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
    // Helpers (unchanged)
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
        try { a.onTriggerEnter?.(b); } catch (e) { console.error(e); }
        try { b.onTriggerEnter?.(a); } catch (e) { console.error(e); }
    }

    // ============================================================
    // Resolution — dispatcher + narrowphase resolvers
    // ============================================================
    _resolve(a, b, aabbA, aabbB) {
        const ta = a.collision.type ?? "aabb";
        const tb = b.collision.type ?? "aabb";

        if ((ta === "capsule" && tb === "plane") || (ta === "plane" && tb === "capsule")) {
            if (ta === "capsule") this._resolveCapsulePlane(a, b, aabbA, aabbB);
            else this._resolveCapsulePlane(b, a, aabbB, aabbA);
            return;
        }

        if ((ta === "capsule" && (tb === "box" || tb === "aabb" || tb === "mesh")) ||
            (tb === "capsule" && (ta === "box" || ta === "aabb" || ta === "mesh"))) {
            if (ta === "capsule") this._resolveCapsuleBox(a, b, aabbA, aabbB);
            else this._resolveCapsuleBox(b, a, aabbB, aabbA);
            return;
        }

        if ((ta === "sphere" && (tb === "box" || tb === "aabb")) ||
            (tb === "sphere" && (ta === "box" || ta === "aabb"))) {
            if (ta === "sphere") this._resolveSphereBox(a, b, aabbA, aabbB);
            else this._resolveSphereBox(b, a, aabbB, aabbA);
            return;
        }

        if (ta === "capsule" && tb === "capsule") {
            this._resolveCapsuleBox(a, b, aabbA, aabbB);
            return;
        }

        this._resolveAABB(a, b, aabbA, aabbB);
    }

    // ------------------------------------------------------------
    // Generic AABB resolver (fallback)
    // ------------------------------------------------------------
    _resolveAABB(a, b, aabbA, aabbB) {
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

        const dir = (this._center(a)[axis] < this._center(b)[axis]) ? -1 : 1;

        this._pushback(a, b, axis, pen, dir);
        this._velocityResponse(a, b, axis);
    }

    // ------------------------------------------------------------
    // Capsule vs Plane (one-sided ground collision) - accurate
    // a = capsule (dynamic usually), b = plane (static)
    // ------------------------------------------------------------
    _resolveCapsulePlane(capsuleEnt, planeEnt, aabbCaps, aabbPlane) {
        const pa = capsuleEnt.props.physics;

        if (!pa) return;
        if (pa.mode === "static") return;

        const planeTop = aabbPlane.max.y;

        const prevY = Number(capsuleEnt._prevY ?? capsuleEnt.props.y ?? capsuleEnt.position?.data?.[1] ?? 0);
        const curY = Number(capsuleEnt.props.y ?? capsuleEnt.position?.data?.[1] ?? 0);
        const movingDown = (pa?.velocity?.y ?? 0) <= 0 || curY < prevY;

        const EPS = 0.05;

        const previouslyAbove = (prevY >= (planeTop - EPS));
        const currentlyIntersectingY = (aabbCaps.min.y <= aabbPlane.max.y && aabbCaps.max.y >= aabbPlane.min.y);

        if (!currentlyIntersectingY) return;

        if (previouslyAbove || movingDown) {
            const targetTop = aabbPlane.max.y + EPS;
            const shift = targetTop - aabbCaps.max.y;
            capsuleEnt.props.y += shift;
            if (typeof capsuleEnt.updateMatrix === "function") capsuleEnt.updateMatrix();

            if (capsuleEnt.props.physics) {
                capsuleEnt.props.physics.grounded = true;
                if (capsuleEnt.props.physics.mode === "dynamic") {
                    if ((capsuleEnt.props.physics.velocity?.y ?? 0) <= 0) capsuleEnt.props.physics.velocity.y = 0;
                }
            }
        }
    }

    // ------------------------------------------------------------
    // Capsule vs Box (approximate) - treat capsule as vertical box with radius for X/Z
    // capsule = a, box = b (a is capsule)
    // ------------------------------------------------------------
    _resolveCapsuleBox(a, b, aabbA, aabbB) {
        const pa = a.props.physics;
        const pb = b.props.physics;

        if (!pa && !pb) return;
        if (pa?.mode === "static" && pb?.mode === "static") return;

        // approximate capsule as box with extents: x/z radius*2, y = capsule height
        const radius = a.collision.radius ?? 0.35;
        const height = a.collision.height ?? (aabbA.max.y - aabbA.min.y);
        const centerX = (aabbA.min.x + aabbA.max.x) * 0.5;
        const centerY = (aabbA.min.y + aabbA.max.y) * 0.5;
        const centerZ = (aabbA.min.z + aabbA.max.z) * 0.5;

        const capBox = {
            min: { x: centerX - radius, y: centerY - height*0.5, z: centerZ - radius },
            max: { x: centerX + radius, y: centerY + height*0.5, z: centerZ + radius }
        };

        // compute overlap along axes between capBox and b's AABB
        const ox = Math.min(capBox.max.x - aabbB.min.x, aabbB.max.x - capBox.min.x);
        const oy = Math.min(capBox.max.y - aabbB.min.y, aabbB.max.y - capBox.min.y);
        const oz = Math.min(capBox.max.z - aabbB.min.z, aabbB.max.z - capBox.min.z);

        let axis = "x", pen = ox;
        if (oy < pen) { axis = "y"; pen = oy; }
        if (oz < pen) { axis = "z"; pen = oz; }

        // direction: use centers
        const dir = (centerX < (aabbB.min.x + aabbB.max.x) * 0.5 && axis === "x") ? -1 :
            (centerZ < (aabbB.min.z + aabbB.max.z) * 0.5 && axis === "z") ? -1 :
                (centerY < (aabbB.min.y + aabbB.max.y) * 0.5 && axis === "y") ? -1 : 1;

        // push back respecting static/dynamic
        this._pushback(a, b, axis, pen, dir);
        this._velocityResponse(a, b, axis);
    }

    // ------------------------------------------------------------
    // Sphere vs Box (accurate)
    // sphere = a, box = b (a is sphere)
    // ------------------------------------------------------------
    _resolveSphereBox(sphereEnt, boxEnt, aabbSphere, aabbBox) {
        const pa = sphereEnt.props.physics;
        const pb = boxEnt.props.physics;

        if (!pa && !pb) return;
        if (pa?.mode === "static" && pb?.mode === "static") return;

        // sphere center
        const cx = (aabbSphere.min.x + aabbSphere.max.x) * 0.5;
        const cy = (aabbSphere.min.y + aabbSphere.max.y) * 0.5;
        const cz = (aabbSphere.min.z + aabbSphere.max.z) * 0.5;
        const r = sphereEnt.collision.radius ?? Math.max(
            (aabbSphere.max.x - aabbSphere.min.x),
            (aabbSphere.max.y - aabbSphere.min.y),
            (aabbSphere.max.z - aabbSphere.min.z)
        ) * 0.5;

        // closest point on box to sphere center
        const closest = {
            x: Math.max(aabbBox.min.x, Math.min(cx, aabbBox.max.x)),
            y: Math.max(aabbBox.min.y, Math.min(cy, aabbBox.max.y)),
            z: Math.max(aabbBox.min.z, Math.min(cz, aabbBox.max.z))
        };

        const dx = cx - closest.x;
        const dy = cy - closest.y;
        const dz = cz - closest.z;
        const dist2 = dx*dx + dy*dy + dz*dz;
        const r2 = r*r;

        if (dist2 === 0) {
            // center is exactly inside box (rare) -> fallback to AABB push
            this._resolveAABB(sphereEnt, boxEnt, aabbSphere, aabbBox);
            return;
        }

        if (dist2 < r2 + 1e-6) {
            const dist = Math.sqrt(dist2);
            const penetration = r - dist;
            // normal from box to sphere center
            const nx = dx / dist, ny = dy / dist, nz = dz / dist;

            // push sphere out along normal by penetration
            if (pa?.mode === "dynamic" && !(pb?.mode === "dynamic")) {
                sphereEnt.props.x += nx * penetration;
                sphereEnt.props.y += ny * penetration;
                sphereEnt.props.z += nz * penetration;
                sphereEnt.updateMatrix?.();
            } else if (pb?.mode === "dynamic" && !(pa?.mode === "dynamic")) {
                boxEnt.props.x -= nx * penetration;
                boxEnt.props.y -= ny * penetration;
                boxEnt.props.z -= nz * penetration;
                boxEnt.updateMatrix?.();
            } else if (pa?.mode === "dynamic" && pb?.mode === "dynamic") {
                const half = penetration * 0.5;
                sphereEnt.props.x += nx * half; sphereEnt.props.y += ny * half; sphereEnt.props.z += nz * half;
                boxEnt.props.x -= nx * half;   boxEnt.props.y -= ny * half;   boxEnt.props.z -= nz * half;
                sphereEnt.updateMatrix?.(); boxEnt.updateMatrix?.();
            }

            // velocity response - zero component along normal if moving into contact
            this._velocityResponseVec(sphereEnt, boxEnt, { x: nx, y: ny, z: nz });
        }
    }

    // ------------------------------------------------------------
    // Pushback (re-uses your existing policy)
    // axis = 'x'|'y'|'z', pen = penetration amount, dir = -1|1
    // ------------------------------------------------------------
    _pushback(a, b, axis, pen, dir) {
        const pa = a.props.physics;
        const pb = b.props.physics;

        if (pa?.mode === "dynamic" && pb?.mode !== "dynamic") {
            a.props[axis] += pen * dir;
            a.updateMatrix?.();
            return;
        }

        if (pb?.mode === "dynamic" && pa?.mode !== "dynamic") {
            b.props[axis] -= pen * dir;
            b.updateMatrix?.();
            return;
        }

        if (pa && pb && pa.mode === "dynamic" && pb.mode === "dynamic") {
            const h = pen * 0.5;
            a.props[axis] += h * dir;
            b.props[axis] -= h * dir;
            a.updateMatrix?.();
            b.updateMatrix?.();
        }
    }

    // ------------------------------------------------------------
    // Velocity response (axis-aligned) - only zero component if it was moving into contact
    // ------------------------------------------------------------
    _velocityResponse(a, b, axis) {
        const pa = a.props.physics;
        const pb = b.props.physics;

        if (pa?.mode === "dynamic") {
            const vel = (pa.velocity?.[axis] ?? 0);
            // approximate contact normal direction using relative positions
            const rel = (a.props[axis] ?? 0) - (b.props?.[axis] ?? 0);
            if (Math.sign(vel) === Math.sign(rel)) {
                pa.velocity[axis] = 0;
            }
        }

        if (pb?.mode === "dynamic") {
            const vel = (pb.velocity?.[axis] ?? 0);
            const rel = (b.props[axis] ?? 0) - (a.props?.[axis] ?? 0);
            if (Math.sign(vel) === Math.sign(rel)) {
                pb.velocity[axis] = 0;
            }
        }
    }

    // ------------------------------------------------------------
    // Velocity response for a normal vector (for sphere-box)
    // zero component along normal for dynamic bodies moving into contact
    // ------------------------------------------------------------
    _velocityResponseVec(a, b, normal) {
        const pa = a.props.physics;
        const pb = b.props.physics;

        if (pa?.mode === "dynamic") {
            const v = pa.velocity ?? { x:0,y:0,z:0 };
            const dot = v.x*normal.x + v.y*normal.y + v.z*normal.z;
            if (dot < 0) {
                // remove normal component (v = v - (v·n) * n)
                pa.velocity.x = v.x - dot * normal.x;
                pa.velocity.y = v.y - dot * normal.y;
                pa.velocity.z = v.z - dot * normal.z;
            }
        }

        if (pb?.mode === "dynamic") {
            const v = pb.velocity ?? { x:0,y:0,z:0 };
            const dot = v.x*normal.x + v.y*normal.y + v.z*normal.z;
            if (dot > 0) {
                pb.velocity.x = v.x - dot * normal.x;
                pb.velocity.y = v.y - dot * normal.y;
                pb.velocity.z = v.z - dot * normal.z;
            }
        }
    }

    // ------------------------------------------------------------
    // utility: center of entity (from props or position)
    // ------------------------------------------------------------
    _center(entity) {
        const p = entity.position?.data ?? [entity.props.x ?? 0, entity.props.y ?? 0, entity.props.z ?? 0];
        return { x: p[0], y: p[1], z: p[2] };
    }
}
