import { Particle } from "@/models/canvas/core/particle/layer/model";
import { ParticleFactory } from "@/models/canvas/core/particle/build/model";

export class ParticleEmitter {

    constructor({
                    ctx, cache, blendLoader,
                    entity = null,
                    world = "2d",
                    webgl = false,
                    texture = null,
                    shape = "quad",
                    radius = 0,
                    rate = 10,
                    max = 1000,
                    lifetime = [0.5, 1.5],
                    speed = [50, 150],
                    spread = Math.PI,
                    size = 1,
                    color = [1,1,1,1],
                    opacity = [1,1],
                    blendMode = "normal",
                    decay = 0,             // Velocity decay
                    turbulence = 0,        // Turbulence strength
                    rotationSpeed = 0,     // Rotation per particle
                    alphaFade = {in:0,out:0}, // Alpha fade
                    sizeOsc = {freq:0, amp:0} // Size oscillation
                }) {
        this.world = world;
        this.webgl = webgl;
        this.shape = shape;
        this.radius = radius;
        this.blendMode = blendMode;

        this.entity = entity ?? ParticleFactory.create({ ctx, cache, blendLoader, texture, width:32, height:32, shape, world, webgl, blendMode });
        this.entity.props.world = world;
        this.entity.props.webgl = webgl;
        this.entity.props.blendMode = blendMode;

        this.rate = rate;
        this.max = max;
        this.lifetime = lifetime;
        this.speed = speed;
        this.spread = spread;
        this.size = size;

        this.color = color;
        this.opacity = opacity;

        // Neue Particle-Attribute
        this.decay = decay;
        this.turbulence = turbulence;
        this.rotationSpeed = rotationSpeed;
        this.alphaFade = alphaFade;
        this.sizeOsc = sizeOsc;

        this._accu = 0;
        this.enabled = true;
    }

    spawn(dt, particles) {
        if (!this.enabled) return;

        this._accu += dt * this.rate;

        while (this._accu >= 1 && particles.length < this.max) {
            this._accu--;

            const angle = Math.random() * this.spread;
            const speed = lerp(this.speed[0], this.speed[1], Math.random());
            const life  = lerp(this.lifetime[0], this.lifetime[1], Math.random());
            const pos   = this._spawnPosition();

            particles.push(new Particle({
                world: this.world,
                shape: this.shape,
                webgl: this.webgl,
                entity: this.entity,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                vz: this.world === "3d" ? 0 : undefined,
                life,
                size: this.size,
                color: this.color.slice(),
                opacity: lerp(this.opacity[0], this.opacity[1], Math.random()),

                // neue Attribute
                decay: this.decay,
                turbulence: this.turbulence,
                rotationSpeed: this.rotationSpeed,
                alphaFade: this.alphaFade,
                sizeOsc: this.sizeOsc
            }));
        }
    }

    _spawnPosition() {
        const r = Math.random() * this.radius;
        const a = Math.random() * Math.PI * 2;
        if (this.world === "2d") return { x: Math.cos(a)*r, y: Math.sin(a)*r, z:0 };
        const z = (Math.random()*2-1)*r;
        return { x: Math.cos(a)*r, y: Math.sin(a)*r, z };
    }
}

const lerp = (a,b,t) => a + (b-a)*t;