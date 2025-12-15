// mesh.glsl
void mesh_vertexTransform(vec3 aPos, vec3 aNormal, vec2 aUV_in, out vec4 outWorldPos, out vec3 outNormal, out vec2 outUV) {
    vec4 worldPos = iModelMatrix * vec4(aPos, 1.0);
    outWorldPos = worldPos;
    outNormal = mat3(iModelMatrix) * aNormal;
    outUV = aUV_in;
}
