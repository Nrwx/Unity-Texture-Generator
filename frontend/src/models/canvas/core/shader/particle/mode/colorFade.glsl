//colorFade.glsl
vec4 applyColorFade(vec4 color, float age, float lifetime, vec4 startColor, vec4 endColor) {
    float t = clamp(age / lifetime, 0.0, 1.0);
    return mix(startColor, endColor, t) * color;
}
