import { AnimationInstance } from "@/models/canvas/core/animation/instance/model";

export class AnimationSystem {
    constructor() {
        this.instances = new Map(); // entity.id -> AnimationInstance
    }

    add(entity, animations = []) {
        const instance = new AnimationInstance(entity, animations);
        this.instances.set(entity.id, instance);
        return instance;
    }

    remove(entityId) {
        this.instances.delete(entityId);
    }

    getInstance(entityId) {
        return this.instances.get(entityId);
    }

    update(dt) {
        for (const inst of this.instances.values()) {
            inst.update(dt);
        }
    }

    bind(entityId, gl, uniforms) {
        const inst = this.instances.get(entityId);
        if (inst) inst.bindToShader(gl, uniforms);
    }
}
