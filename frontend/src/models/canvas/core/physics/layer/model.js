// models/canvas/core/physics/model.js
export class Physics {

    static MODES = {
        STATIC: "static",
        DYNAMIC: "dynamic",
        KINEMATIC: "kinematic"
    };

    constructor({
                    mode = Physics.MODES.DYNAMIC,
                    mass = 1,
                    friction = 0.1,
                    restitution = 0.0,
                    gravity = { x: 0, y: -9.81, z: 0 },
                    velocity = { x: 0, y: 0, z: 0 }
                } = {}) {

        this.mode = mode;
        this.mass = Math.max(0.0001, mass);
        this.friction = friction;
        this.restitution = restitution;

        this.gravity = { ...gravity };
        this.velocity = { ...velocity };
        this.acceleration = { x: 0, y: 0, z: 0 };

        this.forces = [];
    }

    // -------------------------------------------------
    // Forces
    // -------------------------------------------------
    applyForce(force) {
        if (this.mode !== Physics.MODES.DYNAMIC) return;
        this.forces.push(force);
    }

    applyImpulse(impulse) {
        if (this.mode !== Physics.MODES.DYNAMIC) return;
        this.velocity.x += impulse.x / this.mass;
        this.velocity.y += impulse.y / this.mass;
        this.velocity.z += impulse.z / this.mass;
    }

    // -------------------------------------------------
    // Main integration
    // entity.props.x/y/z wird verändert
    // -------------------------------------------------
    integrate(dt, entity) {
        if (this.mode === Physics.MODES.STATIC) return;

        const p = entity.props;

        // Kinematic: Position wird extern gesetzt
        if (this.mode === Physics.MODES.KINEMATIC) {
            entity.updateMatrix();
            return;
        }

        // Reset acceleration
        this.acceleration.x = this.gravity.x;
        this.acceleration.y = this.gravity.y;
        this.acceleration.z = this.gravity.z;

        // Apply forces
        for (const f of this.forces) {
            this.acceleration.x += f.x / this.mass;
            this.acceleration.y += f.y / this.mass;
            this.acceleration.z += f.z / this.mass;
        }

        // Integrate velocity
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        this.velocity.z += this.acceleration.z * dt;

        // Friction (time independent)
        const damping = Math.max(0, 1 - this.friction * dt);
        this.velocity.x *= damping;
        this.velocity.y *= damping;
        this.velocity.z *= damping;

        // Integrate position
        p.x += this.velocity.x * dt;
        p.y += this.velocity.y * dt;
        p.z += this.velocity.z * dt;

        // Clear forces
        this.forces.length = 0;

        // Update entity matrix
        entity.updateMatrix();
    }

    // -------------------------------------------------
    // Bounds (from Geometry)
    // -------------------------------------------------
    getAABB(entity) {
        const geom = entity.props.geometry;
        if (!geom?.bounds) return null;

        const { min, max } = geom.bounds;
        const { x, y, z, scaleX, scaleY, scaleZ } = entity.props;

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

    // -------------------------------------------------
    // Utility
    // -------------------------------------------------
    stop() {
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;
    }
}
