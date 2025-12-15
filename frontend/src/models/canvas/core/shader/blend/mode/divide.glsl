vec3 blendDivide(vec3 b, vec3 s) {
    return b / max(s, 0.00001);
}