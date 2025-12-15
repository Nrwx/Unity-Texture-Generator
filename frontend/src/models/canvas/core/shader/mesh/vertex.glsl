#version 300 es
precision highp float;

// Vertex attributes (engine must bind these locations)
in vec3 aPos;
in vec3 aNormal;
in vec2 aUV;

// tangent: xyz = tangent vector, w = handedness (+1 or -1)
layout(location = 6) in vec4 aTangent;

// Instanced attributes
layout(location = 3) in mat4 iModelMatrix;   // instanced model matrix (mat4 => 4 attribs)
layout(location = 7) in vec4 iUVTransform;   // offset.x, offset.y, scale.x, scale.y
layout(location = 8) in vec4 iColor;         // instance color
layout(location = 9) in float iTexIndex;     // instance texture index (for texture arrays)

// Skeletal animation attributes (optional)
layout(location = 4) in vec4 aBoneWeights;
layout(location = 5) in ivec4 aBoneIndices;
#define MAX_BONES 128
uniform mat4 uBones[MAX_BONES];

// Global uniforms
uniform mat4 uViewProj;
uniform vec2 uUVOffset;
uniform vec2 uUVScale;
uniform float uUVRotation;

// Outputs to fragment
out vec2 vUV;
out vec3 vNormal;
out vec3 vWorldPos;
flat out vec4 vInstanceColor;
flat out float vTexIndex;
out vec3 vTangent;
out float vTangentW;

// include modules (skeletal, mesh helpers, texture transforms)
#include "skeletal.glsl"
#include "mesh.glsl"
#include "textureTransform.glsl"

void main() {
    // apply skinning (works if bones are identity if not used)
    vec4 skinnedPos = applySkinning(vec4(aPos, 1.0));
    // transform normals/tangents with same skinning (as vec4 with w=0 -> direction)
    vec3 skinnedNormal = mat3(applySkinning(vec4(aNormal, 0.0))) * aNormal;
    vec3 skinnedTangent = mat3(applySkinning(vec4(aTangent.xyz, 0.0))) * aTangent.xyz;

    // apply instanced transform
    vec4 worldPos = iModelMatrix * skinnedPos;

    // world normal & tangent
    vec3 worldNormal = mat3(iModelMatrix) * skinnedNormal;
    vec3 worldTangent = mat3(iModelMatrix) * skinnedTangent;

    // apply global UV transform then instance UV transform if present
    vec2 uv = transformUV(aUV, uUVOffset, uUVScale, uUVRotation);
    vec2 iOffset = iUVTransform.xy;
    vec2 iScale  = iUVTransform.zw;
    if (iScale.x == 0.0) iScale.x = 1.0;
    if (iScale.y == 0.0) iScale.y = 1.0;
    uv = (uv - 0.5) * iScale + 0.5 + iOffset;

    // outputs
    vWorldPos = worldPos.xyz;
    vNormal = normalize(worldNormal);
    vTangent = normalize(worldTangent);
    vTangentW = aTangent.w;
    vUV = uv;
    vInstanceColor = iColor;
    vTexIndex = iTexIndex;

    gl_Position = uViewProj * worldPos;
}
