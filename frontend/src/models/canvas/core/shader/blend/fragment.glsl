precision mediump float;

varying vec2 vUv;

uniform sampler2D texBase;
uniform sampler2D texBlend;
uniform int uBlendMode;

#include "blend/modes/_all.glsl"   // wird durch JS ersetzt
#include "blend/dispatcher.glsl"   // blendMode()

void main() {
    vec4 base  = texture2D(texBase, vUv);
    vec4 blend = texture2D(texBlend, vUv);

    gl_FragColor = blendMode(base, blend, uBlendMode);
}
