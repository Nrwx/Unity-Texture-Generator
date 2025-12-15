import { Entity } from "@/models/canvas/core/entity/model";
import { Mesh } from "@/models/canvas/core/mesh/layer/model";

/**
 * MeshFactory: creates Entity + Mesh wrapper and registers textures into material
 */
export class MeshFactory {
    static create({ model, props = {}, textures = {} }) {
        const entity = new Entity(model, { type: "mesh", ...props });

        for (const k of Object.keys(textures)) {
            entity.textures.set(k, textures[k]);
            if (entity.material && k in entity.material) entity.material[k] = textures[k];
        }

        entity.init();
        return new Mesh({ entity });
    }
}
