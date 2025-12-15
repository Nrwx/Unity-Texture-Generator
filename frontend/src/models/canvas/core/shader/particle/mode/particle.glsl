// particle.glsl
// Basisfunktionen für alle Partikel
vec2 applyParticlePosition(vec2 pos, vec2 velocity, float dt) {
    return pos + velocity * dt;
}

float applyParticleLife(float age, float lifetime) {
    return clamp(age / lifetime, 0.0, 1.0);
}

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

vec4 premultiply(vec4 c) {
    return vec4(c.rgb * c.a, c.a);
}