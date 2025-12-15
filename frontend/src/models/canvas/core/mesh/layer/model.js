import { matrixMultiply } from "@/utils/matrix";
import { deg2rad } from "@/utils/matrix";

export class Mesh {
    constructor({ entity }) {
        if (!entity) throw new Error("Mesh requires an Entity");
        this.entity = entity;
        this.props = this.entity.props;
        this.world = this.props.world;
        this.webgl = this.props.webgl;
        this.material = this.entity.material;
        this.matrix = new Float32Array(16);
        this.updateMatrix();
    }

    update(dt = 0) {
        // run physics / animation on entity (if any) before matrix update
        // entity.update(...) normally called elsewhere; we assume entity.props are current
        this.updateMatrix();
    }

    updateMatrix() {
        const p = this.entity.props;
        const x = p.x ?? 0, y = p.y ?? 0, z = p.z ?? 0;
        const scaleX = p.scaleX ?? 1, scaleY = p.scaleY ?? 1, scaleZ = p.scaleZ ?? 1;
        const rotateX = p.rotateX ?? 0, rotateY = p.rotateY ?? 0, rotateZ = p.rotateZ ?? 0;

        let mat = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]);
        const S = new Float32Array([scaleX,0,0,0, 0,scaleY,0,0, 0,0,scaleZ,0, 0,0,0,1]);
        mat = matrixMultiply(mat, S, true);

        if (rotateX) {
            const r = deg2rad(rotateX), c = Math.cos(r), s = Math.sin(r);
            mat = matrixMultiply(mat, new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]), true);
        }
        if (rotateY) {
            const r = deg2rad(rotateY), c = Math.cos(r), s = Math.sin(r);
            mat = matrixMultiply(mat, new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]), true);
        }
        if (rotateZ) {
            const r = deg2rad(rotateZ), c = Math.cos(r), s = Math.sin(r);
            mat = matrixMultiply(mat, new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]), true);
        }

        this.matrix = matrixMultiply(this.entity.props.matrix, mat, this.webgl);
    }
}
