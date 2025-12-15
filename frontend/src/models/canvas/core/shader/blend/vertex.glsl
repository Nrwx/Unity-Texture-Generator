// vertex.glsl
precision mediump float;

// Attribute: Vertex Position und UV
attribute vec2 aPos;
attribute vec2 aUV;

// Varying: an Fragmentshader weitergeben
varying vec2 vUv;

// Uniform: optionale Transform-Matrix
uniform mat3 uMatrix;

void main() {
    // UV-Koordinaten an Fragmentshader weitergeben
    vUv = aUV;

    // Vertex-Position transformieren (2D)
    vec3 pos = uMatrix * vec3(aPos, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
}
