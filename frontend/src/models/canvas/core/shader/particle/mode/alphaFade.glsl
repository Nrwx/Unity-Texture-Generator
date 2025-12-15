// alphaFade.glsl
float applyAlphaFade(float age, float lifetime, float fadeIn, float fadeOut) {
    float t = age / lifetime;
    float alpha = 1.0;
    if (t < fadeIn) alpha *= t / fadeIn;
    if (t > 1.0 - fadeOut) alpha *= (1.0 - t) / fadeOut;
    return clamp(alpha, 0.0, 1.0);
}
