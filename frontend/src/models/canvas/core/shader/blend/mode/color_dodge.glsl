vec3 blendColorDodge(vec3 b, vec3 s) {
    return b / max(1.0 - s, 0.00001);
}