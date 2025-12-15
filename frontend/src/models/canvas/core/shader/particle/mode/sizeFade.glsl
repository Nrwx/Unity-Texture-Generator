// sizeFade.glsl
float applySizeFade(float age, float lifetime, float startSize, float endSize) {
    float t = clamp(age / lifetime, 0.0, 1.0);
    return mix(startSize, endSize, t);
}