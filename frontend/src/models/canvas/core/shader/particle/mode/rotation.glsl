// rotation.glsl
vec2 rotateParticle(vec2 pos, float angle) {
    float cosA = cos(angle);
    float sinA = sin(angle);
    return vec2(
        pos.x * cosA - pos.y * sinA,
        pos.x * sinA + pos.y * cosA
    );
}