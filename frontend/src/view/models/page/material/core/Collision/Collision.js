export class CollisionSystem {
    constructor({ enabled = true } = {}) {
        this.enabled = enabled;
    }

    setEnabled(state) {
        this.enabled = state === true;

        return this;
    }

    step(entities = []) {
        if (!this.enabled || !Array.isArray(entities)) {
            return [];
        }

        const collisions = [];
        const list = entities.filter(entity => entity?.collision);

        list.forEach(entity => {
            entity._prevY = Number(entity._prevY ?? entity.props?.y ?? entity.position?.data?.[1] ?? 0);
        });

        for (let aIndex = 0; aIndex < list.length; aIndex += 1) {
            for (let bIndex = aIndex + 1; bIndex < list.length; bIndex += 1) {
                const a = list[aIndex];
                const b = list[bIndex];

                if (!this.layerMatch(a, b)) {
                    continue;
                }

                const aabbA = a.collision.getAABB();
                const aabbB = b.collision.getAABB();

                if (!aabbA || !aabbB || !this.overlaps(aabbA, aabbB)) {
                    continue;
                }

                collisions.push({ a, b, aabbA, aabbB });

                if (a.collision.isTrigger || b.collision.isTrigger) {
                    this.trigger(a, b);
                    continue;
                }

                this.resolve(a, b, aabbA, aabbB);
            }
        }

        return collisions;
    }

    raycast(ray, entities = []) {
        if (!ray || !Array.isArray(entities)) {
            return [];
        }

        return entities
            .map(entity => {
                const distance = entity?.collision?.intersectsRay?.(ray);

                if (distance === null || distance === undefined) {
                    return null;
                }

                return {
                    entity,
                    distance,
                    depth: entity.collision.getDepth?.() ?? 0,
                };
            })
            .filter(Boolean)
            .sort((a, b) => (
                a.distance !== b.distance
                    ? a.distance - b.distance
                    : b.depth - a.depth
            ));
    }

    layerMatch(a, b) {
        const ca = a?.collision;
        const cb = b?.collision;

        if (!ca || !cb) {
            return false;
        }

        return (ca.mask & cb.layer) !== 0 && (cb.mask & ca.layer) !== 0;
    }

    overlaps(a, b) {
        return (
            a.min.x <= b.max.x && a.max.x >= b.min.x &&
            a.min.y <= b.max.y && a.max.y >= b.min.y &&
            a.min.z <= b.max.z && a.max.z >= b.min.z
        );
    }

    trigger(a, b) {
        a?.onTriggerEnter?.(b);
        b?.onTriggerEnter?.(a);
    }

    resolve(a, b, aabbA, aabbB) {
        const typeA = a.collision.type ?? "aabb";
        const typeB = b.collision.type ?? "aabb";

        if (typeA === "sphere" && ["box", "aabb"].includes(typeB)) {
            this.resolveSphereBox(a, b, aabbA, aabbB);
            return;
        }

        if (typeB === "sphere" && ["box", "aabb"].includes(typeA)) {
            this.resolveSphereBox(b, a, aabbB, aabbA);
            return;
        }

        if (typeA === "capsule" && typeB === "plane") {
            this.resolveCapsulePlane(a, b, aabbA, aabbB);
            return;
        }

        if (typeB === "capsule" && typeA === "plane") {
            this.resolveCapsulePlane(b, a, aabbB, aabbA);
            return;
        }

        this.resolveAABB(a, b, aabbA, aabbB);
    }

    resolveAABB(a, b, aabbA, aabbB) {
        const physicsA = a.props?.physics;
        const physicsB = b.props?.physics;

        if (!this.canResolve(physicsA, physicsB)) {
            return;
        }

        const overlap = {
            x: Math.min(aabbA.max.x - aabbB.min.x, aabbB.max.x - aabbA.min.x),
            y: Math.min(aabbA.max.y - aabbB.min.y, aabbB.max.y - aabbA.min.y),
            z: Math.min(aabbA.max.z - aabbB.min.z, aabbB.max.z - aabbA.min.z),
        };
        const axis = Object.entries(overlap)
            .sort((left, right) => left[1] - right[1])[0][0];
        const direction = this.center(a)[axis] < this.center(b)[axis] ? -1 : 1;

        this.pushback(a, b, axis, overlap[axis], direction);
        this.velocityResponse(a, b, axis);
    }

    resolveCapsulePlane(capsule, plane, capsuleAABB, planeAABB) {
        const physics = capsule.props?.physics;

        if (!physics || physics.mode === "static") {
            return;
        }

        const prevY = Number(capsule._prevY ?? capsule.props?.y ?? capsule.position?.data?.[1] ?? 0);
        const curY = Number(capsule.props?.y ?? capsule.position?.data?.[1] ?? 0);
        const movingDown = (physics.velocity?.y ?? 0) <= 0 || curY < prevY;
        const intersectingY = capsuleAABB.min.y <= planeAABB.max.y && capsuleAABB.max.y >= planeAABB.min.y;

        if (!intersectingY || !movingDown) {
            return;
        }

        const targetTop = planeAABB.max.y + 0.05;
        const shift = targetTop - capsuleAABB.max.y;

        capsule.props.y += shift;
        capsule.updateMatrix?.();

        physics.grounded = true;

        if (physics.mode === "dynamic" && (physics.velocity?.y ?? 0) <= 0) {
            physics.velocity.y = 0;
        }
    }

    resolveSphereBox(sphere, box, sphereAABB, boxAABB) {
        const physicsA = sphere.props?.physics;
        const physicsB = box.props?.physics;

        if (!this.canResolve(physicsA, physicsB)) {
            return;
        }

        const center = {
            x: (sphereAABB.min.x + sphereAABB.max.x) * 0.5,
            y: (sphereAABB.min.y + sphereAABB.max.y) * 0.5,
            z: (sphereAABB.min.z + sphereAABB.max.z) * 0.5,
        };
        const radius = sphere.collision.radius ?? Math.max(
            sphereAABB.max.x - sphereAABB.min.x,
            sphereAABB.max.y - sphereAABB.min.y,
            sphereAABB.max.z - sphereAABB.min.z,
        ) * 0.5;
        const closest = {
            x: Math.max(boxAABB.min.x, Math.min(center.x, boxAABB.max.x)),
            y: Math.max(boxAABB.min.y, Math.min(center.y, boxAABB.max.y)),
            z: Math.max(boxAABB.min.z, Math.min(center.z, boxAABB.max.z)),
        };
        const normal = {
            x: center.x - closest.x,
            y: center.y - closest.y,
            z: center.z - closest.z,
        };
        const distanceSq = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;

        if (distanceSq <= 0 || distanceSq >= radius * radius) {
            return;
        }

        const distance = Math.sqrt(distanceSq);
        const penetration = radius - distance;

        normal.x /= distance;
        normal.y /= distance;
        normal.z /= distance;

        this.pushAlongNormal(sphere, box, normal, penetration);
        this.velocityResponseVector(sphere, box, normal);
    }

    canResolve(physicsA, physicsB) {
        if (!physicsA && !physicsB) {
            return false;
        }

        return !(physicsA?.mode === "static" && physicsB?.mode === "static");
    }

    pushback(a, b, axis, penetration, direction) {
        const physicsA = a.props?.physics;
        const physicsB = b.props?.physics;

        if (physicsA?.mode === "dynamic" && physicsB?.mode !== "dynamic") {
            a.props[axis] += penetration * direction;
            a.updateMatrix?.();
            return;
        }

        if (physicsB?.mode === "dynamic" && physicsA?.mode !== "dynamic") {
            b.props[axis] -= penetration * direction;
            b.updateMatrix?.();
            return;
        }

        if (physicsA?.mode === "dynamic" && physicsB?.mode === "dynamic") {
            const half = penetration * 0.5;

            a.props[axis] += half * direction;
            b.props[axis] -= half * direction;
            a.updateMatrix?.();
            b.updateMatrix?.();
        }
    }

    pushAlongNormal(a, b, normal, penetration) {
        const physicsA = a.props?.physics;
        const physicsB = b.props?.physics;

        if (physicsA?.mode === "dynamic" && physicsB?.mode !== "dynamic") {
            this.translate(a, normal, penetration);
            return;
        }

        if (physicsB?.mode === "dynamic" && physicsA?.mode !== "dynamic") {
            this.translate(b, normal, -penetration);
            return;
        }

        if (physicsA?.mode === "dynamic" && physicsB?.mode === "dynamic") {
            this.translate(a, normal, penetration * 0.5);
            this.translate(b, normal, -penetration * 0.5);
        }
    }

    translate(entity, normal, amount) {
        entity.props.x += normal.x * amount;
        entity.props.y += normal.y * amount;
        entity.props.z += normal.z * amount;
        entity.updateMatrix?.();
    }

    velocityResponse(a, b, axis) {
        this.zeroVelocityAxis(a, b, axis);
        this.zeroVelocityAxis(b, a, axis);
    }

    zeroVelocityAxis(entity, other, axis) {
        const physics = entity.props?.physics;

        if (physics?.mode !== "dynamic" || !physics.velocity) {
            return;
        }

        const relative = (entity.props?.[axis] ?? 0) - (other.props?.[axis] ?? 0);

        if (Math.sign(physics.velocity[axis] ?? 0) === Math.sign(relative)) {
            physics.velocity[axis] = 0;
        }
    }

    velocityResponseVector(a, b, normal) {
        this.removeNormalVelocity(a, normal, dot => dot < 0);
        this.removeNormalVelocity(b, normal, dot => dot > 0);
    }

    removeNormalVelocity(entity, normal, shouldRemove) {
        const physics = entity.props?.physics;
        const velocity = physics?.velocity;

        if (physics?.mode !== "dynamic" || !velocity) {
            return;
        }

        const dot = velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;

        if (!shouldRemove(dot)) {
            return;
        }

        velocity.x -= dot * normal.x;
        velocity.y -= dot * normal.y;
        velocity.z -= dot * normal.z;
    }

    center(entity) {
        const position = entity.position?.data ?? [
            entity.props?.x ?? 0,
            entity.props?.y ?? 0,
            entity.props?.z ?? 0,
        ];

        return {
            x: position[0],
            y: position[1],
            z: position[2],
        };
    }
}
