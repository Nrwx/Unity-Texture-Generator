import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";

const toArray3 = (value, fallback = [0, 0, 0]) => Vector.from(value, fallback).toArray();

export class Ray {
    constructor(origin = [0, 0, 0], dir = [0, 0, -1]) {
        this.origin = Vector.from(origin).toArray();
        this.dir = Vector.from(dir, [0, 0, -1]).normalize([0, 0, -1]).toArray();
    }

    static from(value = {}) {
        if (value instanceof Ray) {
            return value;
        }

        return new Ray(value.origin, value.dir || value.direction);
    }

    static fromCamera(camera, x, y, viewport) {
        const ray = camera.rayFromScreen(x, y, viewport);
        return Ray.from(ray);
    }

    at(distance = 0) {
        return [
            this.origin[0] + this.dir[0] * distance,
            this.origin[1] + this.dir[1] * distance,
            this.origin[2] + this.dir[2] * distance,
        ];
    }

    projectPoint(point) {
        const p = toArray3(point);
        const vx = p[0] - this.origin[0];
        const vy = p[1] - this.origin[1];
        const vz = p[2] - this.origin[2];
        return vx * this.dir[0] + vy * this.dir[1] + vz * this.dir[2];
    }

    distanceToPoint(point) {
        const t = this.projectPoint(point);
        const projected = this.at(Math.max(0, t));
        const p = toArray3(point);
        return Math.hypot(p[0] - projected[0], p[1] - projected[1], p[2] - projected[2]);
    }
}
