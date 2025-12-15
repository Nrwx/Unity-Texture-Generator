vec3 blendSubtract(vec3 b, vec3 s) {
    return max(b - s, 0.0);
}