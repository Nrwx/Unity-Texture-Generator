vec3 blendSoftLight(vec3 b, vec3 s) {
    return (1.0 - 2.0 * s) * b * b + 2.0 * s * b;
}