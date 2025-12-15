vec3 blendLinearBurn(vec3 b, vec3 s) {
    return max(b + s - 1.0, 0.0);
}