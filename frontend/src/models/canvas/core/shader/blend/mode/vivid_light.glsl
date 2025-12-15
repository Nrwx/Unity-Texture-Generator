vec3 blendVividLight(vec3 b, vec3 s) {
    return mix(
        1.0 - (1.0 - b) / max(s * 2.0, 0.00001),
        b / max(2.0 * (1.0 - s), 0.00001),
        step(0.5, s)
    );
}