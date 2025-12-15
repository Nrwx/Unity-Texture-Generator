// velocityDecay.glsl
vec2 applyVelocityDecay(vec2 velocity, float decay, float dt) {
    return velocity * pow(1.0 - decay, dt);
}
