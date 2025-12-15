precision mediump float;

varying vec2 vUv;

// Blend-Shader
uniform sampler2D texBase;
uniform sampler2D texBlend;
uniform int uBlendMode;

// Particle-Shader
uniform sampler2D uTex;
uniform float uOpacity;
uniform vec4 uColor;

// ============================
// Module werden durch Loader eingefügt
// ============================
// #include "blend/modes/_all.glsl"
// #include "blend/dispatcher.glsl"
// #include "particle/modes/_all.glsl"

void main() {
    // Basis-Farbwerte
    vec4 base  = texture2D(texBase, vUv);
    vec4 blend = texture2D(texBlend, vUv);
    vec4 particle = texture2D(uTex, vUv) * uColor;
    particle.a *= uOpacity;

    if(particle.a <= 0.001) discard;

    // Blend + Particle zusammenführen
    vec4 color = blendMode(base, blend, uBlendMode);
    gl_FragColor = color + particle * particle.a;
}
