// skeletal.glsl
#define MAX_BONES 128
uniform mat4 uBones[MAX_BONES];
layout(location = 4) in vec4 aBoneWeights;
layout(location = 5) in ivec4 aBoneIndices;

vec4 applySkinning(vec4 pos) {
    mat4 boneMat =
        aBoneWeights.x * uBones[aBoneIndices.x] +
        aBoneWeights.y * uBones[aBoneIndices.y] +
        aBoneWeights.z * uBones[aBoneIndices.z] +
        aBoneWeights.w * uBones[aBoneIndices.w];
    return boneMat * pos;
}
