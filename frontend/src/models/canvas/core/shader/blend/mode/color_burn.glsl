vec3 blendColorBurn(vec3 b, vec3 s) {
    return 1.0 - (1.0 - b) / max(s, 0.00001);
}