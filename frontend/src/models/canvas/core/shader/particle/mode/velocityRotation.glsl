// velocityRotation.glsl
float applyVelocityRotation(vec2 velocity) {
    return atan(velocity.y, velocity.x);
}
