// lighting.glsl
// Simple lighting: Lambert diffuse + Blinn-Phong specular using specular map and roughness

uniform sampler2D uSpecular;
uniform sampler2D uRoughness;

vec3 calcSpecular(vec3 N, vec3 L, vec3 V, float roughness, vec3 specColor) {
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float shin = max(2.0, (1.0 - roughness) * 64.0);
    float spec = pow(NdotH, shin);
    return spec * specColor;
}

vec3 calcLighting(vec3 N, vec3 lightDir, vec3 baseColor) {
    vec3 V = normalize(-vWorldPos); // approximate camera at origin in view space
    float NdotL = max(dot(N, lightDir), 0.0);
    vec3 diffuse = baseColor * NdotL;

    vec3 specColor = texture(uSpecular, vUV).rgb;
    float roughness = texture(uRoughness, vUV).r;
    vec3 specular = calcSpecular(N, lightDir, V, roughness, specColor);

    return diffuse + specular;
}
