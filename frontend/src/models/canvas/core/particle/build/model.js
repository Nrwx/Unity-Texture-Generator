import { Entity } from "@/models/canvas/core/entity/model";

export class ParticleFactory {

    static create({
                      ctx,
                      cache,
                      blendLoader,

                      texture = null,
                      width = 32,
                      height = 32,
                      opacity = 1,
                      shape = "quad",

                      world = "2d",
                      webgl = false,
                      blendMode = "normal"
                  }) {

        const entity = new Entity(
            { ctx, cache, blendLoader },
            {
                width,
                height,
                opacity,
                url: texture,
                hidden: false,

                world,
                webgl,
                blendMode,

                textureMode: "diffuse"
            }
        );

        entity.init();

        // 🔒 Markierung: nicht Scene-owned
        entity.props.__particleInternal = true;

        return entity;
    }
}
