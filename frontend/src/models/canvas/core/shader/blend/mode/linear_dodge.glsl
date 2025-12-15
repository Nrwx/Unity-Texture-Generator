vec3 blendLinearDodge(vec3 b, vec3 s) {
    return min(b + s, 1.0);
}