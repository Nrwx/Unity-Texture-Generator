import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { number } from "@/utils/math";

export class Ray {
    constructor(origin = [0, 0, 0], dir = [0, 1, 0]) {
        this.origin = Vector.from(origin).toArray();
        this.dir = Vector.normalize(dir, [0, 1, 0]).toArray();
    }

    static from(value = {}) {
        if (value instanceof Ray) {
            return value;
        }

        return new Ray(value.origin, value.dir || value.direction);
    }

    static fromCamera(camera, x, y, viewport) {
        return Ray.from(camera.rayFromScreen(x, y, viewport));
    }

    at(distance = 0) {
        const amount = number(distance, 0);
        const origin = this.origin;
        const dir = this.dir;

        return [
            origin[0] + dir[0] * amount,
            origin[1] + dir[1] * amount,
            origin[2] + dir[2] * amount,
        ];
    }

    projectPoint(point) {
        const p = Vector.from(point);
        const origin = Vector.from(this.origin);
        const dir = Vector.from(this.dir);

        return p.sub(origin).dot(dir);
    }

    distanceToPoint(point) {
        const p = Vector.from(point);
        const origin = Vector.from(this.origin);
        const dir = Vector.from(this.dir);

        const t = Math.max(0, p.clone().sub(origin).dot(dir));
        const closest = origin.clone().addScaled(dir, t);

        return p.distance(closest);
    }
}