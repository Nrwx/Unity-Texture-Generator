#version 300 es
precision highp float;

in vec2 vUV;
in vec3 vNormal;
in vec3 vWorldPos;
flat in vec4 vInstanceColor;
flat in float vTexIndex;
in vec3 vTangent;
in float vTangentW;

// material textures (samplers)
uniform sampler2D uDiffuse;
uniform sampler2D uNormal;
uniform sampler2D uSpecular;
uniform sampler2D uRoughness;
uniform sampler2D uMetallic;
uniform sampler2D uAmbientOcclusion;
uniform sampler2D uLight;

// optional texture array (useful for packed atlases or array textures)
// If you don't use arrays you can ignore these uniforms; set uUseTextureArray = 0 in JS.
uniform sampler2DArray uDiffuseArray;
uniform sampler2DArray uNormalArray; // optional array for normals
uniform int uUseTextureArray; // 0 = use uDiffuse/uNormal, 1 = use arrays

// vertex / instance color fallback
uniform vec4 uVertexColor;

// alpha threshold
uniform float uAlphaThreshold;

// outputs
out vec4 fragColor;

// include material / lighting / alpha mask / vertex color helpers
#include "material.glsl"
#include "lighting.glsl"
#include "alphaMask.glsl"
#include "vertexColor.glsl"

void main() {
    // Sample material color (handles arrays + texIndex)
    vec4 baseColor = getMaterialColor(vUV, vTexIndex, uUseTextureArray);

    // apply uniform vertex color and per-instance color multiplicatively
    baseColor = applyVertexColor(baseColor, uVertexColor);
    baseColor = baseColor * vInstanceColor;

    // sample normal map (handles arrays/fallback)
    vec3 nMap = sampleNormal(vUV, vTexIndex, uUseTextureArray);
    // convert to [-1,1]
    nMap = normalize(nMap * 2.0 - 1.0);

    // build TBN matrix from interpolated tangent + normal + handedness
    vec3 T = normalize(vTangent);
    vec3 N = normalize(vNormal);
    vec3 B = normalize(cross(N, T) * vTangentW);
    mat3 TBN = mat3(T, B, N);

    vec3 finalNormal = normalize(TBN * nMap);

    // compute lighting using finalNormal
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    vec3 lit = calcLighting(finalNormal, lightDir, baseColor.rgb);

    fragColor = vec4(lit, baseColor.a);

    // alpha test / discard
    alphaMask(fragColor.a, uAlphaThreshold);
}
