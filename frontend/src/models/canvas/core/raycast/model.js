export class Raycast {
    constructor(origin, direction) {
        this.origin = origin;   // {x,y}
        this.dir = direction;   // normalized {x,y}
    }

    // ============================================================
    // Cast against Scene
    // ============================================================
    cast(scene) {
        const hits = [];

        for (const seg of scene.segments) {
            const entities = [...seg.layers, ...seg.base];

            for (const entity of entities) {
                const col = entity.collision;
                if (!col) continue;

                const dist = col.intersectsRay(this);
                if (dist === null) continue;

                hits.push({
                    entity,
                    distance: dist,
                    depth: col.getDepth(),
                    segment: seg.id
                });
            }
        }

        return this._sortHits(hits);
    }

    // ============================================================
    // Sort: Frontmost First
    // ============================================================
    _sortHits(hits) {
        return hits.sort((a, b) => {
            // 1️⃣ nearer
            if (a.distance !== b.distance) {
                return a.distance - b.distance;
            }
            // 2️⃣ higher depth
            return b.depth - a.depth;
        });
    }
}
