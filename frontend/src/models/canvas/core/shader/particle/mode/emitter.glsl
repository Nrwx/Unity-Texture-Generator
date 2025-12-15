//emitter.glsl

uniform float uTime;

vec2 spawnParticle(vec2 emitterPos, float spread, float speed, float angle) {
    float dx = cos(angle) * speed;
    float dy = sin(angle) * speed;
    return emitterPos + vec2(dx, dy);
}

float lifeFade(float age, float life) {
    return saturate(1.0 - age / life);
}