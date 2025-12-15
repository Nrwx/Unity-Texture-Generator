// material/model.js
export class Material {
    constructor({
                    diffuse = null,
                    normal = null,
                    specular = null,
                    roughness = null,
                    metallic = null,
                    ao = null,
                    light = null,
                    // optional pre-built array objects
                    diffuseArray = null // {texture, width, height, layers}
                } = {}) {
        this.diffuse = diffuse;
        this.normal = normal;
        this.specular = specular;
        this.roughness = roughness;
        this.metallic = metallic;
        this.ao = ao;
        this.light = light;

        // optional prebuilt texture arrays (WebGL2)
        this.diffuseArray = diffuseArray;
    }

    /**
     * locations: object with uniform locations, e.g. { uDiffuse, uNormal, uDiffuseArray, uUseTextureArray, ... }
     */
    bind(gl, locations = {}) {
        if (!locations) return;

        const bind2D = (texObj, loc, unit) => {
            if (texObj && loc !== undefined) {
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, texObj.texture || texObj);
                gl.uniform1i(loc, unit);
            } else if (loc !== undefined) {
                // ensure some slot is bound
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, null);
                gl.uniform1i(loc, unit);
            }
        };

        // If a prebuilt array is available and shader supports it, bind it
        if (this.diffuseArray && locations.uDiffuseArray !== undefined && (gl instanceof WebGL2RenderingContext)) {
            // bind sampler2DArray at unit 0 (or provided)
            const unit = locations.arrayUnit ?? 0;
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.diffuseArray.texture);
            gl.uniform1i(locations.uDiffuseArray, unit);

            // inform shader we use array (optional uniform)
            if (locations.uUseTextureArray !== undefined) {
                gl.uniform1i(locations.uUseTextureArray, 1);
            }
        } else {
            // fallback: bind per-slot textures to separate units
            if (locations.uUseTextureArray !== undefined) {
                gl.uniform1i(locations.uUseTextureArray, 0);
            }

            // map each material slot to a unit (uDiffuse = unit0, uNormal = unit1 etc.)
            bind2D(this.diffuse, locations.uDiffuse, 0);
            bind2D(this.normal, locations.uNormal, 1);
            bind2D(this.specular, locations.uSpecular, 2);
            bind2D(this.roughness, locations.uRoughness, 3);
            bind2D(this.metallic, locations.uMetallic, 4);
            bind2D(this.ao, locations.uAO, 5);
            bind2D(this.light, locations.uLight, 6);

            // unbind any TEXTURE_2D_ARRAY unit if present
            if (locations.uDiffuseArray !== undefined && (gl instanceof WebGL2RenderingContext)) {
                const arrUnit = locations.arrayUnit ?? 0;
                gl.activeTexture(gl.TEXTURE0 + arrUnit);
                gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
            }
        }
    }
}
