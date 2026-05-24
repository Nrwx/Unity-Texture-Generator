import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { Ray } from "@/view/models/page/material/core/Ray/Ray";

const EPSILON = 1e-7;
const v3 = (value, fallback = [0, 0, 0]) => Vector.from(value, fallback).toArray();
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const length = a => Math.hypot(a[0], a[1], a[2]);
const normalize = (a, fallback = [0, 0, 1]) => {
    const len = length(a);
    return len > EPSILON ? mul(a, 1 / len) : fallback.slice();
};

export class Intersection {
    static rayPlane(rayLike, plane = {}) {
        const ray = Ray.from(rayLike);
        const point = v3(plane.point, [0, 0, 0]);
        const normal = normalize(v3(plane.normal, [0, 0, 1]));
        const denom = dot(normal, ray.dir);

        if (Math.abs(denom) < EPSILON) {
            return null;
        }

        const t = dot(sub(point, ray.origin), normal) / denom;

        if (t < 0) {
            return null;
        }

        return {
            distance: t,
            point: ray.at(t),
            normal,
        };
    }

    static rayTriangle(rayLike, a, b, c, options = {}) {
        const ray = Ray.from(rayLike);
        const v0 = v3(a);
        const v1 = v3(b);
        const v2 = v3(c);
        const edge1 = sub(v1, v0);
        const edge2 = sub(v2, v0);
        const pvec = cross(ray.dir, edge2);
        const det = dot(edge1, pvec);
        const cullBackface = options.cullBackface === true;

        if (cullBackface ? det < EPSILON : Math.abs(det) < EPSILON) {
            return null;
        }

        const invDet = 1 / det;
        const tvec = sub(ray.origin, v0);
        const u = dot(tvec, pvec) * invDet;

        if (u < 0 || u > 1) {
            return null;
        }

        const qvec = cross(tvec, edge1);
        const v = dot(ray.dir, qvec) * invDet;

        if (v < 0 || u + v > 1) {
            return null;
        }

        const t = dot(edge2, qvec) * invDet;

        if (t < 0) {
            return null;
        }

        return {
            distance: t,
            point: ray.at(t),
            barycentric: [1 - u - v, u, v],
            normal: normalize(cross(edge1, edge2)),
        };
    }

    static raySegmentDistance(rayLike, a, b) {
        const ray = Ray.from(rayLike);
        const p = ray.origin;
        const d1 = ray.dir;
        const q = v3(a);
        const d2 = sub(v3(b), q);
        const r = sub(p, q);
        const aDot = dot(d1, d1);
        const eDot = dot(d2, d2);
        const f = dot(d2, r);
        let s = 0;
        let t = 0;

        if (eDot <= EPSILON) {
            s = 0;
            t = Math.max(0, -dot(d1, r) / Math.max(aDot, EPSILON));
        } else {
            const c = dot(d1, r);
            const bDot = dot(d1, d2);
            const denom = aDot * eDot - bDot * bDot;

            if (denom !== 0) {
                s = Math.max(0, (bDot * f - c * eDot) / denom);
            }

            t = (bDot * s + f) / eDot;

            if (t < 0) {
                t = 0;
                s = Math.max(0, -c / Math.max(aDot, EPSILON));
            } else if (t > 1) {
                t = 1;
                s = Math.max(0, (bDot - c) / Math.max(aDot, EPSILON));
            }
        }

        const c1 = add(p, mul(d1, s));
        const c2 = add(q, mul(d2, t));

        return {
            distance: length(sub(c1, c2)),
            rayDistance: s,
            segmentT: t,
            pointOnRay: c1,
            pointOnSegment: c2,
        };
    }

    static raySphere(rayLike, center, radius = 1) {
        const ray = Ray.from(rayLike);
        const c = v3(center);
        const oc = sub(ray.origin, c);
        const b = dot(oc, ray.dir);
        const cTerm = dot(oc, oc) - radius * radius;
        const h = b * b - cTerm;

        if (h < 0) {
            return null;
        }

        const t = -b - Math.sqrt(h);
        const distance = t >= 0 ? t : -b + Math.sqrt(h);

        if (distance < 0) {
            return null;
        }

        return {
            distance,
            point: ray.at(distance),
        };
    }
}
