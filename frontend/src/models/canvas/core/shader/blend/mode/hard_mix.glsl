vec3 blendHardMix(vec3 b, vec3 s) {
    vec3 v = blendVividLight(b, s);
    return step(0.5, v);
}