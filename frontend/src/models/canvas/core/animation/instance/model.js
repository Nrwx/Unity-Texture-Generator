export class AnimationInstance {
    constructor(entity, animations = []) {
        this.entity = entity;
        this.bones = entity.props.bones || [];
        this.animations = animations;
        this.activeAnimation = animations[0] || null;
        this.time = 0;
    }

    update(dt) {
        if (!this.activeAnimation) return;
        this.time += dt;
        this.time %= this.activeAnimation.duration;

        const boneMats = this.activeAnimation.getBoneMatricesAt(this.time);
        for (let i = 0; i < this.bones.length; i++) {
            this.bones[i].matrix = boneMats[i] || this.bones[i].matrix;
        }
    }

    bindToShader(gl, uniforms) {
        if (!uniforms.uBones) return;
        for (let i = 0; i < this.bones.length && i < 128; i++) {
            gl.uniformMatrix4fv(uniforms.uBones[i], false, this.bones[i].matrix);
        }
    }
}
