import { Vector } from "@/view/models/page/material/core/Math/Vector/Vector";
import { Ray } from "@/view/models/page/material/core/Ray/Ray";
import { EPSILON, number } from "@/utils/math";

export class Intersection {
    static rayPlane(rayLike, plane = {}) {
        const ray = Ray.from(rayLike);
        const origin = Vector.from(ray.origin);
        const direction = Vector.from(ray.dir);

        const point = Vector.from(plane.point, [0, 0, 0]);
        const normal = Vector.normalize(plane.normal, [0, 0, 1]);

        const denom = normal.dot(direction);

        if (Math.abs(denom) < EPSILON) {
            return null;
        }

        const t = point.clone().sub(origin).dot(normal) / denom;

        if (t < 0) {
            return null;
        }

        return {
            distance: t,
            point: ray.at(t),
            normal: normal.toArray(),
        };
    }

    static rayTriangle(rayLike, a, b, c, options = {}) {
        const ray = Ray.from(rayLike);
        const origin = Vector.from(ray.origin);
        const direction = Vector.from(ray.dir);

        const v0 = Vector.from(a);
        const v1 = Vector.from(b);
        const v2 = Vector.from(c);

        const edge1 = v1.clone().sub(v0);
        const edge2 = v2.clone().sub(v0);

        const pvec = Vector.cross(direction, edge2);
        const det = edge1.dot(pvec);
        const cullBackface = options.cullBackface === true;

        if (cullBackface ? det < EPSILON : Math.abs(det) < EPSILON) {
            return null;
        }

        const invDet = 1 / det;
        const tvec = origin.clone().sub(v0);
        const u = tvec.dot(pvec) * invDet;

        if (u < 0 || u > 1) {
            return null;
        }

        const qvec = Vector.cross(tvec, edge1);
        const v = direction.dot(qvec) * invDet;

        if (v < 0 || u + v > 1) {
            return null;
        }

        const t = edge2.dot(qvec) * invDet;

        if (t < 0) {
            return null;
        }

        return {
            distance: t,
            point: ray.at(t),
            barycentric: [1 - u - v, u, v],
            normal: Vector.cross(edge1, edge2).normalize([0, 0, 1]).toArray(),
        };
    }

    static raySegmentDistance(rayLike, a, b) {
        const ray = Ray.from(rayLike);
        const p = Vector.from(ray.origin);
        const d1 = Vector.from(ray.dir);

        const q = Vector.from(a);
        const d2 = Vector.from(b).sub(q);
        const r = p.clone().sub(q);

        const aDot = d1.lengthSq();
        const eDot = d2.lengthSq();
        const f = d2.dot(r);

        let s = 0;
        let t;

        if (eDot <= EPSILON) {
            s = 0;
            t = Math.max(0, -d1.dot(r) / Math.max(aDot, EPSILON));
        } else {
            const c = d1.dot(r);
            const bDot = d1.dot(d2);
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

        const c1 = p.clone().addScaled(d1, s);
        const c2 = q.clone().addScaled(d2, t);

        return {
            distance: c1.distance(c2),
            rayDistance: s,
            segmentT: t,
            pointOnRay: c1.toArray(),
            pointOnSegment: c2.toArray(),
        };
    }

    static raySphere(rayLike, center, radius = 1) {
        const ray = Ray.from(rayLike);
        const origin = Vector.from(ray.origin);
        const direction = Vector.from(ray.dir);
        const c = Vector.from(center);
        const r = number(radius, 1);

        const oc = origin.clone().sub(c);
        const b = oc.dot(direction);
        const cTerm = oc.dot(oc) - r * r;
        const h = b * b - cTerm;

        if (h < 0) {
            return null;
        }

        const sqrtH = Math.sqrt(h);
        const t = -b - sqrtH;
        const distance = t >= 0 ? t : -b + sqrtH;

        if (distance < 0) {
            return null;
        }

        return {
            distance,
            point: ray.at(distance),
        };
    }
}