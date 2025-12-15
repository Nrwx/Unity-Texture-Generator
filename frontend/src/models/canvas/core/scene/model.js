import { sortFilter } from "@/models/canvas/core/utils/model";
import { matrixMultiply } from "@/utils/matrix";
import { Entity } from "@/models/canvas/core/entity/model";
import { Camera } from "@/models/canvas/core/camera/model";
import { Orbit } from "@/models/canvas/core/events/orbit/model";
import { CollisionSystem } from "@/models/canvas/core/collision/model";
import { PhysicsSystem } from "@/models/canvas/core/physics/model";

export class Scene {
    constructor(model) {
        this.model = model;

        // Core
        this.ctx = model.ctx;
        this.cache = model.cache;
        this.blendLoader = model.blendLoader;
        this.program = model.program;

        // Viewport / Tiles
        this.viewport = model.viewport;
        this.tileSize = model.tileSize ?? 256;

        this.mesh = model.mesh;
        this.physics = new PhysicsSystem();
        this.collision = new CollisionSystem();

        // Entities
        this.entities = (model.entities ?? []).map(props =>
            new Entity({ ctx: this.ctx, cache: this.cache, blendLoader: this.blendLoader }, props)
        );

        // Camera & Orbit
        if (model.mode === "world" || model.mode === "editor") {
            this.camera = new Camera({
                type: model.world ?? "2d",
                position: model.camera.position,
                target: model.camera.target,
                zoom: model.camera.zoom,
                fov: model.camera.fov,
                near: model.camera.near,
                far: model.camera.far
            });

            this.orbit = new Orbit({
                camera: this.camera,
                mode: model.world ?? "2d"
            });
        }

        this.background = model.background ?? null;

        // Segments & Tiles
        this.segments = [];
        this.tiles = new Map();

        // Render-Reihenfolge nach Typ
        this.renderOrder = [
            Entity.TYPES.MESH,
            Entity.TYPES.OBJECT,
            Entity.TYPES.TREE,
            Entity.TYPES.EFFECT,
            Entity.TYPES.TEXTURE
        ];
    }

    init() {
        const vp = this.viewport;
        this._initSegments(vp.rows, vp.columns, vp.width, vp.height);
        this._assignEntitiesByType();

        for (const entity of this.entities) {
            entity.uniforms = entity.uniforms || this.model.uniforms || {
                uOpacity: this.ctx.getUniformLocation(this.program, "uOpacity"),
                uBlendMode: this.ctx.getUniformLocation(this.program, "uBlendMode"),
                uMatrix: this.ctx.getUniformLocation(this.program, "uMatrix"),
                uTex: this.ctx.getUniformLocation(this.program, "uTex")
            };
            entity.init();
        }

        return this;
    }

    update(dt) {
        this.physics.step(dt, this.entities);
        this.collision.step(this.entities);
        this.mesh.update(dt);
    }

    // ================= Segments / Tiles =================
    _initSegments(rows, cols, segWidth, segHeight) {
        const needed = rows * cols;
        while (this.segments.length < needed) {
            this.segments.push({
                id: null,
                row: 0,
                col: 0,
                width: segWidth,
                height: segHeight,
                entities: [],
                matrix: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
            });
        }

        if (this.segments.length > needed) this.segments.length = needed;

        let i = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const seg = this.segments[i];
                seg.id = `${r}-${c}`;
                seg.row = r;
                seg.col = c;
                this._splitSegmentIntoTiles(seg);
                i++;
            }
        }
    }

    _tileKey(segId, row, col) {
        return `${segId}:${row}:${col}`;
    }

    _splitSegmentIntoTiles(seg) {
        const cols = Math.ceil(seg.width / this.tileSize);
        const rows = Math.ceil(seg.height / this.tileSize);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const key = this._tileKey(seg.id, r, c);
                if (!this.tiles.has(key)) {
                    const w = Math.min(this.tileSize, seg.width - c * this.tileSize);
                    const h = Math.min(this.tileSize, seg.height - r * this.tileSize);
                    this.tiles.set(key, {
                        segId: seg.id,
                        row: r,
                        col: c,
                        pixelW: w,
                        pixelH: h,
                        worldX: c * this.tileSize,
                        worldY: r * this.tileSize,
                        uploaded: false,
                        _pendingCanvas: null,
                        _forceEntities: new Set()
                    });
                }
            }
        }
    }

    // ================= Entity Assignment =================
    _assignEntitiesByType() {
        const vp = this.viewport;
        const singleMode = vp.rows === 1 && vp.columns === 1;

        for (const seg of this.segments) seg.entities = [];

        for (const type of this.renderOrder) {
            const filtered = this.entities.filter(e => e.type === type);
            this._placeEntities(filtered, singleMode);
        }
    }

    _placeEntities(arr, singleMode) {
        const vp = this.viewport;

        for (const entity of arr) {
            const ex0 = entity.props?.x ?? 0;
            const ey0 = entity.props?.y ?? 0;
            const ew = entity.props?.width ?? 0;
            const eh = entity.props?.height ?? 0;
            const ex1 = ex0 + ew;
            const ey1 = ey0 + eh;

            if (singleMode) {
                const seg = this.segments[0];
                seg.entities.push(entity);
                entity.props.segId = seg.id;
                continue;
            }

            if (entity.props?.segId) {
                const segTarget = this.segments.find(s => s.id === entity.props.segId);
                if (segTarget) {
                    segTarget.entities.push(entity);
                    continue;
                }
            }

            for (const seg of this.segments) {
                const segX0 = seg.col * vp.width;
                const segY0 = seg.row * vp.height;
                const segX1 = segX0 + seg.width;
                const segY1 = segY0 + seg.height;

                if (ex1 <= segX0 || ex0 >= segX1 || ey1 <= segY0 || ey0 >= segY1) continue;

                seg.entities.push(entity);
                if (!entity.props.segId) entity.props.segId = seg.id;
            }
        }
    }

    // ================= Rasterize / Tiles =================
    async rasterizeEntity(entity, segment) {
        const cols = Math.ceil(segment.width / this.tileSize);
        const rows = Math.ceil(segment.height / this.tileSize);
        const eX0 = entity.props.x;
        const eY0 = entity.props.y;
        const eX1 = eX0 + entity.props.width;
        const eY1 = eY0 + entity.props.height;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const key = this._tileKey(segment.id, r, c);
                const tile = this.tiles.get(key);
                if (!tile) continue;

                const tX0 = tile.worldX;
                const tY0 = tile.worldY;
                const tX1 = tX0 + tile.pixelW;
                const tY1 = tY0 + tile.pixelH;

                if (eX1 <= tX0 || eX0 >= tX1 || eY1 <= tY0 || eY0 >= tY1) continue;

                tile._forceEntities.add(entity);
            }
        }
    }

    async redrawForcedTiles() {
        for (const tile of this.tiles.values()) {
            if (tile._forceEntities.size === 0) continue;

            const off = (typeof OffscreenCanvas !== "undefined")
                ? new OffscreenCanvas(tile.pixelW, tile.pixelH)
                : (() => { const c = document.createElement("canvas"); c.width = tile.pixelW; c.height = tile.pixelH; return c; })();

            const ctx = off.getContext("2d");
            for (const entity of tile._forceEntities) {
                ctx.save();
                ctx.translate(-tile.worldX, -tile.worldY);
                ctx.beginPath();
                ctx.rect(tile.worldX, tile.worldY, tile.pixelW, tile.pixelH);
                ctx.clip();
                entity.draw2D?.(ctx);
                ctx.restore();
            }

            tile._pendingCanvas = off;
            tile.uploaded = true;
            tile._forceEntities.clear();
        }
    }

    // ================= Raycast =================
    raycastScreen(x, y) {
        if (!this.camera || !this.collision) return [];

        // =====================================================
        // 2D MODE → Punktabfrage (Pseudo-Ray)
        // =====================================================
        if (this.camera.mode === "2d") {
            const worldPos = this.camera.screenToWorld(x, y, this.viewport);
            if (!worldPos) return [];

            // Fake-Ray: Punkt + feste Z-Richtung
            const ray = {
                origin: worldPos,
                dir: { x: 0, y: 0, z: -1 }
            };

            return this.collision.raycast(ray, this.entities);
        }

        // =====================================================
        // 3D MODE → echter Ray
        // =====================================================
        const ray = this.camera.rayFromScreen(x, y, this.viewport);
        if (!ray) return [];

        return this.collision.raycast(ray, this.entities);
    }

    // ================= Draw =================
    async draw() {
        this.orbit?.update();
        this.camera?.update(this.viewport);

        for (const seg of sortFilter(this.segments)) {
            const allEntities = seg.entities ?? [];
            for (const entity of allEntities) {
                const combinedMatrix = matrixMultiply(seg.matrix, entity.props.matrix);
                entity.update({ matrix: combinedMatrix });
                await this.rasterizeEntity(entity, seg);
            }
        }

        await this.redrawForcedTiles();

        for (const seg of this.segments) {
            const allEntities = seg.entities ?? [];
            for (const entity of allEntities) {
                entity.draw();
            }
        }
    }
}
