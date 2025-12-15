// turbulence.glsl
vec2 applyTurbulence(vec2 velocity, vec2 position, float strength, float time) {
    float n = sin(position.x * 12.9898 + position.y * 78.233 + time) * 43758.5453;
    return velocity + vec2(fract(n) - 0.5, fract(n * 1.3) - 0.5) * strength;
}
