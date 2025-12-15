// sizeOscillation.glsl
float applySizeOscillation(float baseSize, float time, float frequency, float amplitude) {
    return baseSize * (1.0 + sin(time * frequency) * amplitude);
}
