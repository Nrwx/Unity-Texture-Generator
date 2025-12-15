// gravity.glsl
vec2 applyGravity(vec2 velocity, float dt) {
    const vec2 g = vec2(0.0, -9.81); // Downwards
    return velocity + g * dt;
}
