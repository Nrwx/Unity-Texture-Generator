// attractor.glsl
vec2 applyAttractor(vec2 position, vec2 target, float strength, float dt) {
    vec2 dir = target - position;
    float len = length(dir);
    if (len > 0.0) dir /= len;
    return dir * strength * dt;
}
