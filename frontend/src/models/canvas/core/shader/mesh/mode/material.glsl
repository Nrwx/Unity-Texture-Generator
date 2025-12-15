// material.glsl
// provides sampling helpers for diffuse + normal, supports texture arrays when flagged

uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform sampler2D uSpecular;
uniform sampler2D uRoughness;
uniform sampler2D uMetallic;
uniform sampler2D uAmbientOcclusion;
uniform sampler2D uLight;

uniform sampler2DArray uDiffuseArray;
uniform sampler2DArray uNormalArray;

vec4 sampleDiffuse(vec2 uv, float texIndex, int useArray) {
    if (useArray == 1) {
        // use texIndex as layer. clamp to non-negative and within shader bounds.
        float layer = max(0.0, texIndex);
        return texture(uDiffuseArray, vec3(uv, layer));
    } else {
        return texture(uDiffuse, uv);
    }
}

vec3 sampleNormal(vec2 uv, float texIndex, int useArray) {
    if (useArray == 1) {
        float layer = max(0.0, texIndex);
        return texture(uNormalArray, vec3(uv, layer)).rgb;
    } else {
        return texture(uNormal, uv).rgb;
    }
}

float sampleRoughness(vec2 uv) {
    return texture(uRoughness, uv).r;
}
float sampleMetallic(vec2 uv) {
    return texture(uMetallic, uv).r;
}
float sampleAO(vec2 uv) {
    return texture(uAmbientOcclusion, uv).r;
}
vec3 sampleLightMap(vec2 uv) {
    return texture(uLight, uv).rgb;
}

// Top-level color getter used by fragment shader
vec4 getMaterialColor(vec2 uv, float texIndex, int useArray) {
    vec4 diff = sampleDiffuse(uv, texIndex, useArray);
    float ao = sampleAO(uv);
    vec3 light = sampleLightMap(uv);
    vec3 col = diff.rgb * ao;
    col = mix(col, light, 0.5);
    return vec4(col, diff.a);
}
