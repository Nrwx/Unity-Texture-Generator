#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;   // Quad vertices
layout(location = 1) in vec2 aUV;

// Instanced Attributes
layout(location = 2) in vec3 iPos;       // Partikelposition
layout(location = 3) in float iSize;    // Partikelgröße
layout(location = 4) in vec4 iColor;    // Partikelfarbe
layout(location = 5) in float iOpacity; // Transparenz
layout(location = 6) in float iLife;    // Lebenszeit-Ratio (0..1)
layout(location = 7) in float iRotationSpeed; // Rotation pro Particle
layout(location = 8) in float iSizeOscFreq;   // Size Oscillation Frequency

uniform mat4 uViewProj;
uniform mat4 uEntityMatrix;
uniform float uTime;

out vec2 vUV;
out vec4 vColor;
out float vLife;

void main() {
    // Rotation der Quad vertices
    float angle = iRotationSpeed * uTime;
    mat2 rot = mat2(cos(angle), -sin(angle),
                    sin(angle),  cos(angle));
    vec2 rotatedPos = rot * aPos;

    // Size-Oscillation
    float scale = iSize * (1.0 + sin(uTime * iSizeOscFreq));

    vec3 pos = vec3(rotatedPos * scale, 0.0);
    pos += iPos;

    // Transformation: Entity-Matrix + Kamera
    gl_Position = uViewProj * uEntityMatrix * vec4(pos, 1.0);

    vUV = aUV;
    vColor = vec4(iColor.rgb, iColor.a * iOpacity);
    vLife = iLife;
}
