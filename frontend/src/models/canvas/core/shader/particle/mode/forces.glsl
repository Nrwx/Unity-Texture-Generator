//forces.glsl

vec2 applyForces(vec2 velocity, vec2 force, float dt) {
    return velocity + force * dt;
}

vec2 swirl(vec2 uv, float strength) {
    vec2 c = uv - 0.5;
    float a = length(c) * strength;
    float s = sin(a);
    float cA = cos(a);
    mat2 r = mat2(cA, -s, s, cA);
    return r * c + 0.5;
}