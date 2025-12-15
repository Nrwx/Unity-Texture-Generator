vec3 rgb2hsl(vec3 c) {
    float maxc = max(max(c.r, c.g), c.b);
    float minc = min(min(c.r, c.g), c.b);
    float l = (maxc + minc) * 0.5;

    float s = 0.0;
    float h = 0.0;

    if (maxc != minc) {
        float d = maxc - minc;
        s = (l > 0.5) ? d / (2.0 - maxc - minc) : d / (maxc + minc);

        if (maxc == c.r) {
            h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
        } else if (maxc == c.g) {
            h = (c.b - c.r) / d + 2.0;
        } else {
            h = (c.r - c.g) / d + 4.0;
        }

        h /= 6.0;
    }

    return vec3(h, s, l);
}


vec3 hsl2rgb(vec3 hsl);

vec3 setHue(vec3 base, vec3 blend) {
    vec3 b = rgb2hsl(base);
    vec3 s = rgb2hsl(blend);
    return hsl2rgb(vec3(s.x, b.y, b.z));
}

vec3 setSaturation(vec3 base, vec3 blend) {
    vec3 b = rgb2hsl(base);
    vec3 s = rgb2hsl(blend);
    return hsl2rgb(vec3(b.x, s.y, b.z));
}

vec3 setColor(vec3 base, vec3 blend) {
    vec3 b = rgb2hsl(base);
    vec3 s = rgb2hsl(blend);
    return hsl2rgb(vec3(s.x, s.y, b.z));
}

vec3 setLuminosity(vec3 base, vec3 blend) {
    vec3 b = rgb2hsl(base);
    vec3 s = rgb2hsl(blend);
    return hsl2rgb(vec3(b.x, b.y, s.z));
}