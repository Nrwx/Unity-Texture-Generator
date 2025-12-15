// alphaMask.glsl
void alphaMask(float alpha, float threshold) {
    if (alpha < threshold) discard;
}
