import { matrix2dAffineTo4x4, matrixMultiply, matrixTranslate } from "@/utils/matrix";

export class Particle {
    constructor({
                    entity,
                    world="2d",
                    webgl=false,
                    shape="quad",
                    x=0, y=0, z=0,
                    vx=0, vy=0, vz=0,
                    life=1,
                    size=1,
                    opacity=1,
                    color=[1,1,1,1],

                    // neue Mods
                    decay=0,
                    turbulence=0,
                    rotationSpeed=0,
                    alphaFade={in:0,out:0},
                    sizeOsc={freq:0,amp:0}
                }) {
        this.entity = entity;
        this.world = world;
        this.webgl = webgl;
        this.shape = shape;

        this.x = x; this.y = y; this.z = world==="3d"?z:0;
        this.vx = vx; this.vy = vy; this.vz = world==="3d"?vz:0;

        this.life = life; this.age = 0; this.lifeRatio = 0;

        this.size = size;
        this.opacity = opacity;
        this.color = color;

        this.decay = decay;
        this.turbulence = turbulence;
        this.rotationSpeed = rotationSpeed;
        this.alphaFade = alphaFade;
        this.sizeOsc = sizeOsc;

        this.matrix = new Float32Array(16);
        this.alive = true;

        this._updateMatrix();
    }

    update(dt) {
        if(!this.alive) return;

        // Velocity Decay
        const decayFactor = Math.pow(1 - this.decay, dt);
        this.vx *= decayFactor;
        this.vy *= decayFactor;

        // Turbulence
        this.vx += (Math.random()-0.5)*this.turbulence*dt;
        this.vy += (Math.random()-0.5)*this.turbulence*dt;

        // Position
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if(this.world==="3d") this.z += this.vz * dt;

        // Age / Life
        this.age += dt;
        this.lifeRatio = this.age/this.life;
        if(this.age >= this.life) this.alive = false;

        // Size Oscillation
        if(this.sizeOsc.freq>0) this.size *= 1 + Math.sin(this.age*this.sizeOsc.freq)*this.sizeOsc.amp;

        this._updateMatrix();
    }

    _updateMatrix() {
        if(this.world==="2d") {
            const local = matrix2dAffineTo4x4({x:this.x, y:this.y, a:this.size, d:this.size});
            this.matrix = matrixMultiply(this.entity.props.matrix, local, this.webgl);
        } else {
            const local = matrixTranslate({x:this.x, y:this.y, z:this.z}, null, this.webgl);
            this.matrix = matrixMultiply(this.entity.props.matrix, local, this.webgl);
        }
    }
}