vec3 blendLinearLight(vec3 b, vec3 s) {
    return clamp(b + 2.0 * s - 1.0, 0.0, 1.0);
}
