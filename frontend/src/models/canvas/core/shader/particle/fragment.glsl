#version 300 es
precision highp float;

in vec2 vUV;
in vec4 vColor;
in float vLife;

uniform sampler2D uTex;

// Optional: globale Alpha-Fade
uniform float uAlphaIn;
uniform float uAlphaOut;

out vec4 fragColor;

void main() {
    vec4 tex = texture(uTex, vUV);

    // Basisfarbe anwenden
    fragColor = tex * vColor;

    // Lebenszeit-basiertes Fading
    fragColor.a *= 1.0 - vLife;

    // Alpha-Fade für Ein-/Ausblenden
    fragColor.a *= mix(uAlphaIn, uAlphaOut, vLife);

    // Transparenz-Check
    if (fragColor.a <= 0.001) discard;
}
