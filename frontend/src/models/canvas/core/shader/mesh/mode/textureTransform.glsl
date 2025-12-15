// textureTransform.glsl
vec2 transformUV(vec2 uv, vec2 offset, vec2 scale, float rotation) {
    if (scale.x == 0.0) scale.x = 1.0;
    if (scale.y == 0.0) scale.y = 1.0;
    uv -= 0.5;
    float c = cos(rotation);
    float s = sin(rotation);
    uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    uv = uv * scale + 0.5 + offset;
    return uv;
}
