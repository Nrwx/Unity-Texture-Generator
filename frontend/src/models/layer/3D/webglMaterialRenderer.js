const FACE_DEFS = Object.freeze({
    front: {
        normal: [0, 0, 1],
        tangent: [1, 0, 0],
        origin: [-0.5, -0.5, 0.5],
        u: [1, 0, 0],
        v: [0, 1, 0],
    },
    back: {
        normal: [0, 0, -1],
        tangent: [-1, 0, 0],
        origin: [0.5, -0.5, -0.5],
        u: [-1, 0, 0],
        v: [0, 1, 0],
    },
    left: {
        normal: [-1, 0, 0],
        tangent: [0, 0, 1],
        origin: [-0.5, -0.5, -0.5],
        u: [0, 0, 1],
        v: [0, 1, 0],
    },
    right: {
        normal: [1, 0, 0],
        tangent: [0, 0, -1],
        origin: [0.5, -0.5, 0.5],
        u: [0, 0, -1],
        v: [0, 1, 0],
    },
    top: {
        normal: [0, 1, 0],
        tangent: [1, 0, 0],
        origin: [-0.5, 0.5, 0.5],
        u: [1, 0, 0],
        v: [0, 0, -1],
    },
    bottom: {
        normal: [0, -1, 0],
        tangent: [1, 0, 0],
        origin: [-0.5, -0.5, -0.5],
        u: [1, 0, 0],
        v: [0, 0, 1],
    },
});

const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
layout(location = 3) in vec3 aTangent;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNormalMatrix;
uniform float uMaskThreshold;

out vec2 vUv;
out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vTangent;

void main() {
    vec3 pos = aPosition;

    vec4 world = uModel * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    vUv = aUv;
    vNormal = normalize(uNormalMatrix * aNormal);
    vTangent = normalize(uNormalMatrix * aTangent);

    gl_Position = uViewProj * world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
in vec3 vWorldPos;
in vec3 vNormal;
in vec3 vTangent;

uniform sampler2D uBaseMap;
uniform sampler2D uAlphaMap;
uniform sampler2D uNormalMap;
uniform sampler2D uBumpMap;
uniform sampler2D uRoughnessMap;
uniform sampler2D uMetallicMap;
uniform sampler2D uSpecularMap;
uniform sampler2D uEmissionMap;
uniform sampler2D uClearcoatMap;
uniform sampler2D uSubsurfaceMap;
uniform sampler2D uTransmissionMap;
uniform sampler2D uTransmissionRoughnessMap;
uniform sampler2D uIorMap;
uniform sampler2D uSheenMap;
uniform sampler2D uClearcoatRoughnessMap;

uniform int uUseBaseMap;
uniform int uUseAlphaMap;
uniform int uUseNormalMap;
uniform int uUseBumpMap;
uniform int uUseRoughnessMap;
uniform int uUseMetallicMap;
uniform int uUseSpecularMap;
uniform int uUseEmissionMap;
uniform int uUseClearcoatMap;
uniform int uUseSubsurfaceMap;
uniform int uUseTransmissionMap;
uniform int uUseTransmissionRoughnessMap;
uniform int uUseIorMap;
uniform int uUseSheenMap;
uniform int uUseClearcoatRoughnessMap;
uniform int uAlphaMode;

uniform vec4 uBaseColor;
uniform vec4 uSubsurfaceColor;
uniform vec4 uEmissionColor;
uniform float uAlpha;
uniform float uAlphaClip;
uniform float uMaskThreshold;
uniform float uBaseStrength;
uniform float uBaseOffset;
uniform int uBaseInvert;
uniform float uAlphaStrength;
uniform float uAlphaOffset;
uniform int uAlphaInvert;
uniform float uRoughness;
uniform float uRoughnessStrength;
uniform float uRoughnessOffset;
uniform int uRoughnessInvert;
uniform float uMetallic;
uniform float uMetallicStrength;
uniform float uMetallicOffset;
uniform int uMetallicInvert;
uniform float uSpecular;
uniform float uSpecularStrength;
uniform float uSpecularOffset;
uniform int uSpecularInvert;
uniform float uSpecularTint;
uniform float uIor;
uniform float uSubsurface;
uniform float uSubsurfaceStrength;
uniform float uSubsurfaceOffset;
uniform int uSubsurfaceInvert;
uniform vec3 uSubsurfaceRadius;
uniform float uTransmission;
uniform float uTransmissionStrength;
uniform float uTransmissionOffset;
uniform int uTransmissionInvert;
uniform float uTransmissionRoughness;
uniform float uTransmissionRoughnessStrength;
uniform float uTransmissionRoughnessOffset;
uniform int uTransmissionRoughnessInvert;
uniform float uAnisotropic;
uniform float uAnisotropicRotation;
uniform float uSheen;
uniform float uSheenStrength;
uniform float uSheenOffset;
uniform int uSheenInvert;
uniform float uSheenTint;
uniform float uClearcoat;
uniform float uClearcoatStrength;
uniform float uClearcoatOffset;
uniform int uClearcoatInvert;
uniform float uClearcoatRoughness;
uniform float uClearcoatRoughnessStrength;
uniform float uClearcoatRoughnessOffset;
uniform int uClearcoatRoughnessInvert;
uniform float uEmissionStrength;
uniform float uNormalStrength;
uniform float uNormalStrengthInput;
uniform int uNormalInvert;
uniform float uBumpStrength;
uniform float uBumpStrengthInput;
uniform float uBumpOffset;
uniform int uBumpInvert;
uniform float uDiffuseRoughness;
uniform float uSubsurfaceScale;
uniform float uSubsurfaceIor;
uniform float uSubsurfaceAnisotropy;
uniform float uCoatIor;
uniform vec3 uCoatTint;
uniform float uSheenRoughness;
uniform float uThinFilmThickness;
uniform float uThinFilmIor;
uniform float uTangentStrength;
uniform float uIorStrength;
uniform float uIorOffset;
uniform int uIorInvert;

uniform vec3 uCameraPos;
uniform int uLightType;
uniform vec3 uLightPos;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uLightIntensity;
uniform float uLightRange;
uniform float uLightDecay;
uniform float uLightRadius;
uniform float uInnerCone;
uniform float uOuterCone;
uniform vec3 uAmbientColor;
uniform float uAmbientIntensity;
uniform vec3 uEnvironmentColor;
uniform float uReflectionIntensity;
uniform float uGlossIntensity;
uniform float uTransmissionLight;
uniform float uRimIntensity;
uniform float uExposure;
uniform float uContrast;
uniform int uScreenSpaceRefraction;
uniform float uRefractionDepth;
uniform int uSubsurfaceTranslucency;

out vec4 fragColor;

const float PI = 3.14159265359;

float saturate(float v) {
    return clamp(v, 0.0, 1.0);
}

vec3 fresnelSchlick(float cosTheta, vec3 f0) {
    return f0 + (1.0 - f0) * pow(1.0 - saturate(cosTheta), 5.0);
}

float distributionGGX(vec3 n, vec3 h, float roughness) {
    float a = max(roughness * roughness, 0.002);
    float a2 = a * a;
    float ndh = max(dot(n, h), 0.0);
    float d = (ndh * ndh) * (a2 - 1.0) + 1.0;
    return a2 / max(PI * d * d, 0.0001);
}

float geometrySchlickGGX(float ndv, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return ndv / max(ndv * (1.0 - k) + k, 0.0001);
}

float geometrySmith(vec3 n, vec3 v, vec3 l, float roughness) {
    return geometrySchlickGGX(max(dot(n, v), 0.0), roughness) *
        geometrySchlickGGX(max(dot(n, l), 0.0), roughness);
}

float readScalar(sampler2D tex, vec2 uv, float fallbackValue, int enabled) {
    if (enabled == 0) {
        return fallbackValue;
    }

    vec4 s = texture(tex, uv);
    return dot(s.rgb, vec3(0.299, 0.587, 0.114)) * s.a;
}

float applySlotMath(float value, float strength, float offset, int invertInput) {
    float mapped = (invertInput == 1 || strength < 0.0) ? 1.0 - saturate(value) : value;
    return mapped * abs(strength) + offset;
}

float hardMask(float value) {
    return step(uMaskThreshold, saturate(value));
}

float readSlotScalar(
    sampler2D tex,
    vec2 uv,
    float fallbackValue,
    int enabled,
    float strength,
    float offset,
    int invertInput,
    float minValue,
    float maxValue
) {
    float inputValue = fallbackValue;

    if (enabled == 1) {
        vec4 s = texture(tex, uv);
        inputValue = dot(s.rgb, vec3(0.299, 0.587, 0.114)) * s.a;
    }

    float mapped = applySlotMath(inputValue, strength, offset, invertInput);

    if (enabled == 1) {
        return mix(minValue, maxValue, hardMask(mapped));
    }

    return clamp(mapped, minValue, maxValue);
}

vec3 readSlotColor(
    sampler2D tex,
    vec2 uv,
    vec3 fallbackValue,
    int enabled,
    float strength,
    float offset,
    int invertInput
) {
    vec3 inputValue = fallbackValue;

    if (enabled == 1) {
        inputValue = texture(tex, uv).rgb;
    }

    if (invertInput == 1 || strength < 0.0) {
        inputValue = vec3(1.0) - clamp(inputValue, vec3(0.0), vec3(1.0));
    }

    return clamp(inputValue * abs(strength) + vec3(offset), vec3(0.0), vec3(1.0));
}

vec3 safeNormalize(vec3 value, vec3 fallbackValue) {
    float lenSq = dot(value, value);
    if (lenSq < 0.00001) {
        return fallbackValue;
    }

    return value * inversesqrt(lenSq);
}

vec3 thinFilmTint(float thickness, float filmIor, float ndv) {
    if (thickness <= 0.0001) {
        return vec3(1.0);
    }

    float normalizedThickness = clamp(thickness, 0.0, 1200.0) / 1000.0;
    float phase = normalizedThickness * max(filmIor, 1.0) * 10.0 + (1.0 - ndv) * 5.4;
    vec3 tint = 0.62 + 0.38 * cos(vec3(0.0, 2.094395, 4.18879) + phase);
    return max(tint, vec3(0.08));
}

vec3 orenNayarDiffuse(vec3 n, vec3 v, vec3 l, vec3 color, float roughness) {
    float ndl = max(dot(n, l), 0.0);
    float ndv = max(dot(n, v), 0.0);
    float sigma = roughness * roughness;
    float a = 1.0 - 0.5 * (sigma / (sigma + 0.33));
    float b = 0.45 * (sigma / (sigma + 0.09));
    vec3 lv = normalize(l - n * ndl);
    vec3 vv = normalize(v - n * ndv);
    float gamma = max(dot(lv, vv), 0.0);
    float alpha = max(acos(clamp(ndl, 0.0, 1.0)), acos(clamp(ndv, 0.0, 1.0)));
    float beta = min(acos(clamp(ndl, 0.0, 1.0)), acos(clamp(ndv, 0.0, 1.0)));
    float response = a + b * gamma * sin(alpha) * tan(beta);
    return color * response / PI;
}

vec3 resolveNormal(vec3 n) {
    vec3 t = normalize(vTangent);
    vec3 b = normalize(cross(n, t));
    mat3 tbn = mat3(t, b, n);
    vec3 outNormal = n;

    if (uUseNormalMap == 1) {
        vec3 mapNormal = texture(uNormalMap, vUv).xyz * 2.0 - 1.0;
        if (uNormalInvert == 1 || uNormalStrengthInput < 0.0) {
            mapNormal.xy *= -1.0;
        }
        outNormal = normalize(mix(outNormal, normalize(tbn * mapNormal), saturate(max(uNormalStrength, abs(uNormalStrengthInput)))));
    }

    if (uUseBumpMap == 1 && uBumpStrength > 0.0001) {
        vec2 px = vec2(1.0 / 512.0, 1.0 / 512.0);
        float hL = clamp(applySlotMath(texture(uBumpMap, vUv - vec2(px.x, 0.0)).r, uBumpStrengthInput, uBumpOffset, uBumpInvert), 0.0, 1.0);
        float hR = clamp(applySlotMath(texture(uBumpMap, vUv + vec2(px.x, 0.0)).r, uBumpStrengthInput, uBumpOffset, uBumpInvert), 0.0, 1.0);
        float hD = clamp(applySlotMath(texture(uBumpMap, vUv - vec2(0.0, px.y)).r, uBumpStrengthInput, uBumpOffset, uBumpInvert), 0.0, 1.0);
        float hU = clamp(applySlotMath(texture(uBumpMap, vUv + vec2(0.0, px.y)).r, uBumpStrengthInput, uBumpOffset, uBumpInvert), 0.0, 1.0);
        vec3 bump = normalize(vec3((hL - hR) * uBumpStrength, (hD - hU) * uBumpStrength, 1.0));
        outNormal = normalize(mix(outNormal, normalize(tbn * bump), saturate(uBumpStrength)));
    }

    return outNormal;
}

void main() {
    vec4 tex = uUseBaseMap == 1 ? texture(uBaseMap, vUv) : vec4(1.0);
    vec3 albedo = readSlotColor(uBaseMap, vUv, uBaseColor.rgb, uUseBaseMap, uBaseStrength, uBaseOffset, uBaseInvert);

    albedo = mix(albedo, uSubsurfaceColor.rgb, saturate(uSubsurface) * 0.45);
    vec3 subsurfaceBleed = normalize(max(uSubsurfaceRadius, vec3(0.001)));

    float alpha = uAlpha * (uUseBaseMap == 1 ? tex.a : 1.0);
    if (uUseAlphaMap == 1) {
        vec4 alphaTex = texture(uAlphaMap, vUv);
        alpha = hardMask(applySlotMath(
            dot(alphaTex.rgb, vec3(0.299, 0.587, 0.114)) * alphaTex.a,
            uAlphaStrength,
            uAlphaOffset,
            uAlphaInvert
        ));
    }
    alpha = saturate(alpha);

    if (uAlphaMode == 2 && alpha < uAlphaClip) {
        discard;
    }

    if (uAlphaMode == 3) {
        float hash = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (alpha < hash) {
            discard;
        }
    }

    vec3 n = resolveNormal(normalize(vNormal));
    vec3 v = safeNormalize(uCameraPos - vWorldPos, vec3(0.0, 0.0, 1.0));
    vec3 lightVector = uLightPos - vWorldPos;
    float lightDistance = length(lightVector);
    vec3 pointLightDirection = safeNormalize(lightVector, safeNormalize(-uLightDir, vec3(0.2, 0.5, 1.0)));
    vec3 directionalLightDirection = safeNormalize(-uLightDir, vec3(0.2, 0.5, 1.0));
    vec3 l = uLightType == 0 || uLightType == 1 ? directionalLightDirection : pointLightDirection;
    vec3 h = safeNormalize(v + l, n);

    float roughness = readSlotScalar(uRoughnessMap, vUv, uRoughness, uUseRoughnessMap, uRoughnessStrength, uRoughnessOffset, uRoughnessInvert, 0.0, 1.0);
    float metallic = readSlotScalar(uMetallicMap, vUv, uMetallic, uUseMetallicMap, uMetallicStrength, uMetallicOffset, uMetallicInvert, 0.0, 1.0);
    float specular = readSlotScalar(uSpecularMap, vUv, uSpecular, uUseSpecularMap, uSpecularStrength, uSpecularOffset, uSpecularInvert, 0.0, 1.0);
    float clearcoat = readSlotScalar(uClearcoatMap, vUv, uClearcoat, uUseClearcoatMap, uClearcoatStrength, uClearcoatOffset, uClearcoatInvert, 0.0, 1.0);
    float subsurface = readSlotScalar(uSubsurfaceMap, vUv, uSubsurface, uUseSubsurfaceMap, uSubsurfaceStrength, uSubsurfaceOffset, uSubsurfaceInvert, 0.0, 1.0);
    float transmission = readSlotScalar(uTransmissionMap, vUv, uTransmission, uUseTransmissionMap, uTransmissionStrength, uTransmissionOffset, uTransmissionInvert, 0.0, 1.0);
    float transmissionRoughness = readSlotScalar(uTransmissionRoughnessMap, vUv, uTransmissionRoughness, uUseTransmissionRoughnessMap, uTransmissionRoughnessStrength, uTransmissionRoughnessOffset, uTransmissionRoughnessInvert, 0.0, 1.0);
    float ior = readSlotScalar(uIorMap, vUv, uIor, uUseIorMap, uIorStrength, uIorOffset, uIorInvert, 1.0, 4.0);
    float sheen = readSlotScalar(uSheenMap, vUv, uSheen, uUseSheenMap, uSheenStrength, uSheenOffset, uSheenInvert, 0.0, 1.0);
    float diffuseRoughness = saturate(uDiffuseRoughness);
    float clearcoatRoughness = clamp(readSlotScalar(uClearcoatRoughnessMap, vUv, uClearcoatRoughness, uUseClearcoatRoughnessMap, uClearcoatRoughnessStrength, uClearcoatRoughnessOffset, uClearcoatRoughnessInvert, 0.0, 1.0), 0.02, 1.0);
    float sheenRoughness = clamp(uSheenRoughness, 0.02, 1.0);
    float anisotropic = saturate(uAnisotropic);
    roughness = clamp(mix(roughness, roughness * (1.0 - anisotropic * 0.45), anisotropic), 0.02, 1.0);
    float ndl = max(dot(n, l), 0.0);
    float ndv = max(dot(n, v), 0.0);
    float ldh = max(dot(l, h), 0.0);
    float rangeFalloff = uLightType == 0 || uLightType == 1
        ? 1.0
        : pow(saturate(1.0 - lightDistance / max(uLightRange, 0.001)), max(uLightDecay, 0.001));
    float coneFalloff = 1.0;

    if (uLightType == 3) {
        float cone = dot(normalize(uLightDir), -l);
        float innerCone = max(uInnerCone, uOuterCone);
        float outerCone = min(uInnerCone, uOuterCone);
        coneFalloff = smoothstep(outerCone, innerCone, cone);
    }

    float areaSoftening = 1.0 / (1.0 + uLightRadius * 0.18);
    float lightEnergy = uLightIntensity * rangeFalloff * coneFalloff * areaSoftening;

    float f0Scalar = pow((ior - 1.0) / max(ior + 1.0, 0.001), 2.0);
    vec3 specularTintColor = mix(vec3(1.0), albedo, saturate(uSpecularTint));
    vec3 dielectricF0 = vec3(f0Scalar) * mix(0.0, 2.0, specular) * specularTintColor;
    vec3 metalF0 = albedo;
    vec3 filmTint = thinFilmTint(uThinFilmThickness, uThinFilmIor, ndv);
    vec3 f0 = mix(dielectricF0, metalF0, metallic) * filmTint;
    vec3 f = fresnelSchlick(max(dot(h, v), 0.0), f0);
    float d = distributionGGX(n, h, roughness);
    float g = geometrySmith(n, v, l, roughness);
    float slotGloss = (1.0 - roughness) * (0.45 + specular * 1.4 + clearcoat * 0.55);
    vec3 spec = ((d * g * f) / max(4.0 * ndv * ndl, 0.0001)) * slotGloss;

    vec3 tangent = safeNormalize(vTangent, vec3(1.0, 0.0, 0.0));
    vec3 bitangent = safeNormalize(cross(n, tangent), vec3(0.0, 1.0, 0.0));
    vec3 anisotropicDirection = safeNormalize(
        mix(tangent, bitangent, fract(uAnisotropicRotation + uTangentStrength)),
        tangent
    );
    float anisotropicHighlight = pow(
        max(dot(safeNormalize(h - n * dot(h, n), anisotropicDirection), anisotropicDirection), 0.0),
        mix(144.0, 14.0, roughness)
    );
    vec3 anisotropicSpec = specularTintColor * anisotropicHighlight * anisotropic * specular;

    vec3 diffuseColor = mix(albedo, uSubsurfaceColor.rgb, subsurface);
    vec3 diffuse = orenNayarDiffuse(n, v, l, diffuseColor, diffuseRoughness);
    vec3 kd = (vec3(1.0) - f) * (1.0 - metallic) * (1.0 - transmission);
    vec3 directBase = kd * diffuse + spec + anisotropicSpec;

    vec3 subsurfaceRadius = normalize(max(uSubsurfaceRadius, vec3(0.001)));
    float backScatter = pow(1.0 - ndv, 2.0) * (0.35 + 0.65 * saturate(uSubsurfaceAnisotropy));
    float translucencyBoost = uSubsurfaceTranslucency == 1 ? 0.42 : 0.0;
    vec3 subsurfaceLayer = subsurfaceRadius * diffuseColor * subsurface * uSubsurfaceScale * (0.18 + backScatter * (0.32 + translucencyBoost));

    transmissionRoughness = clamp(transmissionRoughness, 0.0, 1.0);
    vec3 refractedDir = refract(-v, n, 1.0 / max(ior, 1.001));
    float refractionFacing = max(dot(safeNormalize(refractedDir, -n), l), 0.0);
    float slotTransmissionLight = transmission * (0.65 + (1.0 - transmissionRoughness) * 0.7 + specular * 0.25);
    float refractionDepth = uScreenSpaceRefraction == 1 ? clamp(uRefractionDepth, 0.0, 10.0) : 0.0;
    vec3 transmissionLayer = albedo * slotTransmissionLight * (0.12 + refractionFacing * (1.0 - transmissionRoughness) * (0.56 + refractionDepth * 0.055));

    vec3 light = (directBase + subsurfaceLayer + transmissionLayer) * uLightColor * lightEnergy * ndl;

    if (clearcoat > 0.0001) {
        float coatF0 = pow((uCoatIor - 1.0) / max(uCoatIor + 1.0, 0.001), 2.0);
        vec3 coatF = fresnelSchlick(max(dot(h, v), 0.0), vec3(coatF0) * uCoatTint * filmTint);
        float coatD = distributionGGX(n, h, clearcoatRoughness);
        float coatG = geometrySmith(n, v, l, clearcoatRoughness);
        light += clearcoat * (coatD * coatG * coatF / max(4.0 * ndv * ndl, 0.0001)) * uLightColor * lightEnergy * ndl;
    }

    float rim = pow(1.0 - ndv, mix(1.25, 3.5, sheenRoughness));
    vec3 sheenColor = mix(vec3(1.0), albedo, uSheenTint);
    float slotRim = rim * (sheen * 0.35 + clearcoat * 0.28 + transmission * 0.22 + (1.0 - roughness) * 0.18);
    light += sheenColor * rim * sheen * lightEnergy * 0.35 * (0.35 + 0.65 * ndl);
    light += uEnvironmentColor * slotRim * (0.25 + 0.75 * (1.0 - roughness));

    vec3 ambient = uAmbientColor * uAmbientIntensity * (albedo * (1.0 - metallic) + f0 * metallic);
    ambient += subsurfaceBleed * diffuseColor * subsurface * uAmbientIntensity * 0.2;
    vec3 reflection = fresnelSchlick(ndv, mix(vec3(0.04), albedo, metallic)) *
        uEnvironmentColor *
        ((1.0 - roughness) * (0.24 + specular * 0.8 + metallic * 0.8 + clearcoat * 0.55)) *
        (1.0 - roughness * 0.82) *
        (0.35 + specular + clearcoat * 0.65);
    vec3 emission = uEmissionColor.rgb * uEmissionStrength;
    if (uUseEmissionMap == 1) {
        emission *= texture(uEmissionMap, vUv).rgb;
    }

    vec3 color = ambient + light + reflection + emission;
    color *= 1.0 + emission.r * 0.04 + transmission * 0.08 + metallic * 0.05;
    color = color / (color + vec3(1.0));
    color = clamp((color - vec3(0.5)) * (1.0 + (1.0 - roughness) * 0.12 + metallic * 0.08) + vec3(0.5), vec3(0.0), vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, alpha);
}`;

const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in float aSize;
layout(location = 2) in float aAlpha;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform float uDpr;

out float vAlpha;

void main() {
    vec4 world = uModel * vec4(aPosition, 1.0);
    vec4 clip = uViewProj * world;
    gl_Position = clip;
    gl_PointSize = max(1.0, aSize * uDpr / max(0.35, clip.w));
    vAlpha = aAlpha;
}`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uParticleMap;
uniform int uUseParticleMap;
uniform vec4 uColor;
uniform float uAlpha;
uniform int uSoft;

in float vAlpha;
out vec4 fragColor;

void main() {
    vec2 uv = gl_PointCoord;
    vec2 centered = uv * 2.0 - 1.0;
    float radial = 1.0 - smoothstep(0.72, 1.0, length(centered));
    vec4 texel = uUseParticleMap == 1 ? texture(uParticleMap, uv) : vec4(1.0);
    float alpha = texel.a * uColor.a * uAlpha * vAlpha * (uSoft == 1 ? radial : 1.0);

    if (alpha <= 0.01) {
        discard;
    }

    fragColor = vec4(texel.rgb * uColor.rgb, alpha);
}`;

const OVERLAY_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform float uPointSize;

void main() {
    gl_Position = uViewProj * uModel * vec4(aPosition, 1.0);
    gl_PointSize = uPointSize;
}`;

const OVERLAY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec4 uColor;
uniform int uPointMode;

out vec4 fragColor;

void main() {
    if (uPointMode == 1) {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = dot(p, p);

        if (d > 1.0) {
            discard;
        }
    }

    fragColor = uColor;
}`;

const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(error || "Shader compile failed");
    }

    return shader;
};

const createProgram = (gl, vertexSource, fragmentSource) => {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(error || "Program link failed");
    }

    return program;
};

const clamp01 = value => Math.min(Math.max(Number(value) || 0, 0), 1);
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const toColor3 = color => Array.isArray(color) ? [toNumber(color[0], 1), toNumber(color[1], 1), toNumber(color[2], 1)] : [1, 1, 1];
const toHexColor3 = (color, fallback = [1, 0.96, 0.9]) => {
    if (Array.isArray(color)) {
        return toColor3(color);
    }

    const value = String(color || "").trim().replace("#", "");

    if (!/^[0-9a-fA-F]{6}$/.test(value)) {
        return fallback;
    }

    return [
        parseInt(value.slice(0, 2), 16) / 255,
        parseInt(value.slice(2, 4), 16) / 255,
        parseInt(value.slice(4, 6), 16) / 255,
    ];
};
const toColor4 = color => {
    const rgb = toColor3(color);
    return [rgb[0], rgb[1], rgb[2], Array.isArray(color) ? toNumber(color[3], 1) : 1];
};

const normalize3 = vector => {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
};

const mat4Identity = () => new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

const mat4Multiply = (a, b) => {
    const out = new Float32Array(16);

    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
            out[col * 4 + row] =
                a[0 * 4 + row] * b[col * 4 + 0] +
                a[1 * 4 + row] * b[col * 4 + 1] +
                a[2 * 4 + row] * b[col * 4 + 2] +
                a[3 * 4 + row] * b[col * 4 + 3];
        }
    }

    return out;
};

const mat4Perspective = (fov, aspect, near, far) => {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);

    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;

    return out;
};

const mat4LookAt = (eye, center, up) => {
    const z = normalize3([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
    const x = normalize3([
        up[1] * z[2] - up[2] * z[1],
        up[2] * z[0] - up[0] * z[2],
        up[0] * z[1] - up[1] * z[0],
    ]);
    const y = [
        z[1] * x[2] - z[2] * x[1],
        z[2] * x[0] - z[0] * x[2],
        z[0] * x[1] - z[1] * x[0],
    ];
    const out = mat4Identity();

    out[0] = x[0];
    out[1] = y[0];
    out[2] = z[0];
    out[4] = x[1];
    out[5] = y[1];
    out[6] = z[1];
    out[8] = x[2];
    out[9] = y[2];
    out[10] = z[2];
    out[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    out[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    out[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);

    return out;
};

const mat4RotateY = angle => {
    const out = mat4Identity();
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    out[0] = c;
    out[2] = -s;
    out[8] = s;
    out[10] = c;

    return out;
};

const mat4RotateX = angle => {
    const out = mat4Identity();
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    out[5] = c;
    out[6] = s;
    out[9] = -s;
    out[10] = c;

    return out;
};

const mat4Scale = (x, y, z) => {
    const out = mat4Identity();

    out[0] = x;
    out[5] = y;
    out[10] = z;

    return out;
};

const mat3FromMat4 = matrix => new Float32Array([
    matrix[0], matrix[1], matrix[2],
    matrix[4], matrix[5], matrix[6],
    matrix[8], matrix[9], matrix[10],
]);

const pushVec3 = (target, value) => {
    target.push(value[0], value[1], value[2]);
};

const buildFaceMesh = (faceName, divisions = 48) => {
    const def = FACE_DEFS[faceName];
    const vertices = [];
    const indices = [];
    const stride = 11;

    for (let y = 0; y <= divisions; y += 1) {
        for (let x = 0; x <= divisions; x += 1) {
            const u = x / divisions;
            const v = y / divisions;
            const pos = [
                def.origin[0] + def.u[0] * u + def.v[0] * v,
                def.origin[1] + def.u[1] * u + def.v[1] * v,
                def.origin[2] + def.u[2] * u + def.v[2] * v,
            ];

            pushVec3(vertices, pos);
            pushVec3(vertices, def.normal);
            vertices.push(u, 1 - v);
            pushVec3(vertices, def.tangent);
        }
    }

    for (let y = 0; y < divisions; y += 1) {
        for (let x = 0; x < divisions; x += 1) {
            const row = divisions + 1;
            const a = y * row + x;
            const b = a + 1;
            const c = a + row;
            const d = c + 1;

            indices.push(a, b, d, a, d, c);
        }
    }

    return {
        faceName,
        stride,
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices),
        count: indices.length,
    };
};

const buildFaceQuadMesh = faceName => buildFaceMesh(faceName, 1);

const buildCoarseFaceMesh = (faceName, divisions = 8) => {
    return buildFaceMesh(faceName, Math.max(1, Math.min(32, Math.trunc(divisions))));
};

const createTexture = (gl, image, fallback = [255, 255, 255, 255]) => {
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (image) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(fallback));
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
};

const textureImage = entry => entry?.image || null;
const hasTexture = entry => Boolean(textureImage(entry));
const shouldUseObjectTextures = previewOverlay => {
    return previewOverlay?.wireframe !== true;
};

const mapEnabled = (useObjectTextures, texture) => {
    return useObjectTextures && hasTexture(texture) ? 1 : 0;
};

const resolvePreviewTexture = (useObjectTextures, resolver) => {
    return useObjectTextures ? resolver() : null;
};
const getMeshPosition = (mesh, index) => {
    const offset = index * mesh.stride;

    return [
        mesh.vertices[offset],
        mesh.vertices[offset + 1],
        mesh.vertices[offset + 2],
    ];
};

const buildOverlayGeometry = mesh => {
    const linePositions = [];
    const pointPositions = [];

    const seenPoints = new Set();

    for (let i = 0; i < mesh.indices.length; i += 3) {
        const a = mesh.indices[i];
        const b = mesh.indices[i + 1];
        const c = mesh.indices[i + 2];

        [
            [a, b],
            [b, c],
            [c, a],
        ].forEach(([from, to]) => {
            linePositions.push(
                ...getMeshPosition(mesh, from),
                ...getMeshPosition(mesh, to)
            );
        });

        [a, b, c].forEach(index => {
            if (seenPoints.has(index)) {
                return;
            }

            seenPoints.add(index);
            pointPositions.push(...getMeshPosition(mesh, index));
        });
    }

    return {
        linePositions: new Float32Array(linePositions),
        pointPositions: new Float32Array(pointPositions),
        lineCount: linePositions.length / 3,
        pointCount: pointPositions.length / 3,
    };
};

const getArrayValues = value => {
    if (value instanceof Float32Array || value instanceof Uint16Array || value instanceof Uint32Array) {
        return Array.from(value);
    }

    if (Array.isArray(value)) {
        return value;
    }

    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort((a, b) => Number(a) - Number(b))
            .map(key => value[key]);
    }

    return [];
};

const normalizeRenderMesh = mesh => {
    if (!mesh || !mesh.stride || !mesh.vertices || !mesh.indices) {
        return null;
    }

    const stride = Number(mesh.stride || 11);
    const vertices = getArrayValues(mesh.vertices).map(value => Number(value) || 0);
    const indices = getArrayValues(mesh.indices).map(value => Math.max(0, Math.trunc(Number(value) || 0)));

    if (stride < 8 || vertices.length < stride * 3 || indices.length < 3) {
        return null;
    }

    const maxIndex = indices.reduce((max, index) => Math.max(max, index), 0);
    const indexArray = mesh.indexType === "uint32" || maxIndex > 65535
        ? new Uint32Array(indices)
        : new Uint16Array(indices);

    return {
        id: mesh.id || "material-mesh",
        primitive: mesh.primitive || mesh.settings?.primitive || "mesh",
        stride,
        vertices: new Float32Array(vertices),
        indices: indexArray,
        count: indexArray.length,
        indexType: indexArray instanceof Uint32Array ? "uint32" : "uint16",
        parts: Array.isArray(mesh.parts) && mesh.parts.length
            ? mesh.parts
            : [{
                name: "mesh",
                faceName: "front",
                start: 0,
                count: indexArray.length,
            }],
        cacheKey: mesh.meta?.renderCacheKey || mesh.meta?.cacheKey || JSON.stringify({
            id: mesh.id || "",
            primitive: mesh.primitive || mesh.settings?.primitive || "mesh",
            count: indexArray.length,
            vertexCount: vertices.length / stride,
        }),
    };
};

const normalizeParticleSystem = system => {
    if (!system || system.enabled !== true) {
        return null;
    }

    const particles = system.particles || {};
    const positions = getArrayValues(particles.positions);
    const sizes = getArrayValues(particles.sizes);
    const alphas = getArrayValues(particles.alphas);
    const count = Math.min(
        Math.max(0, Math.trunc(Number(particles.count || system.count || 0))),
        Math.floor(positions.length / 3)
    );

    if (!count) {
        return null;
    }

    const stride = 5;
    const data = new Float32Array(count * stride);

    for (let index = 0; index < count; index += 1) {
        const source = index * 3;
        const target = index * stride;

        data[target] = Number(positions[source] || 0);
        data[target + 1] = Number(positions[source + 1] || 0);
        data[target + 2] = Number(positions[source + 2] || 0);
        data[target + 3] = Math.max(1, Number(sizes[index] || system.size || 12));
        data[target + 4] = Math.min(Math.max(Number(alphas[index] ?? system.alpha ?? 1), 0), 1);
    }

    return {
        id: system.id || "particle-system",
        count,
        data,
        stride,
        textureSlot: system.texture_slot || "baseColor",
        color: toColor4(system.color || [1, 1, 1, system.alpha ?? 1]),
        alpha: Math.min(Math.max(toNumber(system.alpha, 1), 0), 1),
        blend: system.blend || "alpha",
        depthWrite: system.depth_write === true,
        cacheKey: JSON.stringify({
            id: system.id || "",
            count,
            seed: system.seed,
            age: system.age,
            size: system.size,
            source: system.source,
            emitter: system.emitter,
            mesh: system.use_mesh_reference,
        }),
    };
};

const INT_UNIFORMS = Object.freeze(new Set([
    "uUseBaseMap",
    "uUseAlphaMap",
    "uUseNormalMap",
    "uUseBumpMap",
    "uUseRoughnessMap",
    "uUseMetallicMap",
    "uUseSpecularMap",
    "uUseEmissionMap",
    "uUseClearcoatMap",
    "uUseSubsurfaceMap",
    "uUseTransmissionMap",
    "uUseTransmissionRoughnessMap",
    "uUseIorMap",
    "uUseSheenMap",
    "uUseClearcoatRoughnessMap",
    "uAlphaMode",
    "uLightType",
    "uScreenSpaceRefraction",
    "uSubsurfaceTranslucency",
    "uUseParticleMap",
    "uSoft",

    "uPointMode",
    "uNormalInvert",
    "uBaseInvert",
    "uAlphaInvert",
    "uRoughnessInvert",
    "uMetallicInvert",
    "uSpecularInvert",
    "uClearcoatInvert",
    "uSubsurfaceInvert",
    "uTransmissionInvert",
    "uTransmissionRoughnessInvert",
    "uIorInvert",
    "uSheenInvert",
    "uClearcoatRoughnessInvert",
    "uBumpInvert",
]));

export class WebGLMaterialRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext("webgl2", {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
        });
        this.ready = false;
        this.program = null;
        this.overlayProgram = null;
        this.particleProgram = null;

        this.meshes = new Map();
        this.overlayMeshes = new Map();
        this.particleBuffers = new Map();

        this.textures = new WeakMap();
        this.fallbackTextures = {};

        if (!this.gl) {
            return;
        }

        this.program = createProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);
        this.overlayProgram = createProgram(this.gl, OVERLAY_VERTEX_SHADER, OVERLAY_FRAGMENT_SHADER);
        this.particleProgram = createProgram(this.gl, PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER);
        this.initState();
        this.ready = true;
    }

    initState() {
        const gl = this.gl;

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.fallbackTextures.white = createTexture(gl, null, [255, 255, 255, 255]);
        this.fallbackTextures.black = createTexture(gl, null, [0, 0, 0, 255]);
        this.fallbackTextures.normal = createTexture(gl, null, [128, 128, 255, 255]);
    }

    getMesh(faceName) {
        if (!this.meshes.has(faceName)) {
            const mesh = buildFaceMesh(faceName);
            const gl = this.gl;

            mesh.vao = gl.createVertexArray();
            mesh.vbo = gl.createBuffer();
            mesh.ibo = gl.createBuffer();

            gl.bindVertexArray(mesh.vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

            const stride = mesh.stride * 4;
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
            gl.enableVertexAttribArray(2);
            gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
            gl.enableVertexAttribArray(3);
            gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 8 * 4);
            gl.bindVertexArray(null);

            this.meshes.set(faceName, mesh);
        }

        return this.meshes.get(faceName);
    }

    getOverlayMesh(faceName) {
        if (!this.overlayMeshes.has(faceName)) {
            const gl = this.gl;

            // Faces sollen echte Face-Flächen zeigen, nicht das feine Render-Mesh.
            const faceMesh = buildFaceQuadMesh(faceName);

            // Wireframe bekommt ein eigenes gröberes Grid.
            const lineMesh = buildCoarseFaceMesh(faceName, 8);

            // Vertices bleiben ebenfalls am gröberen Grid, nicht am 48er Render-Mesh.
            const pointMesh = lineMesh;

            const lineOverlay = buildOverlayGeometry(lineMesh);
            const pointOverlay = buildOverlayGeometry(pointMesh);

            const overlay = {
                faceMesh,

                linePositions: lineOverlay.linePositions,
                lineCount: lineOverlay.lineCount,

                pointPositions: pointOverlay.pointPositions,
                pointCount: pointOverlay.pointCount,
            };

            overlay.faceVao = gl.createVertexArray();
            overlay.faceVbo = gl.createBuffer();
            overlay.faceIbo = gl.createBuffer();

            gl.bindVertexArray(overlay.faceVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, overlay.faceVbo);
            gl.bufferData(gl.ARRAY_BUFFER, faceMesh.vertices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, overlay.faceIbo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceMesh.indices, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, faceMesh.stride * 4, 0);

            overlay.lineVao = gl.createVertexArray();
            overlay.lineVbo = gl.createBuffer();

            gl.bindVertexArray(overlay.lineVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, overlay.lineVbo);
            gl.bufferData(gl.ARRAY_BUFFER, overlay.linePositions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);

            overlay.pointVao = gl.createVertexArray();
            overlay.pointVbo = gl.createBuffer();

            gl.bindVertexArray(overlay.pointVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, overlay.pointVbo);
            gl.bufferData(gl.ARRAY_BUFFER, overlay.pointPositions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);

            gl.bindVertexArray(null);

            this.overlayMeshes.set(faceName, overlay);
        }

        return this.overlayMeshes.get(faceName);
    }

    getRenderMesh(sourceMesh) {
        const normalized = normalizeRenderMesh(sourceMesh);

        if (!normalized) {
            return null;
        }

        const key = `mesh:${normalized.cacheKey}`;

        if (!this.meshes.has(key)) {
            const gl = this.gl;
            const mesh = normalized;

            mesh.vao = gl.createVertexArray();
            mesh.vbo = gl.createBuffer();
            mesh.ibo = gl.createBuffer();

            gl.bindVertexArray(mesh.vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
            gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

            const stride = mesh.stride * 4;
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
            gl.enableVertexAttribArray(2);
            gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);
            gl.enableVertexAttribArray(3);
            gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 8 * 4);
            gl.bindVertexArray(null);

            this.meshes.set(key, mesh);
        }

        return this.meshes.get(key);
    }

    getParticleBuffer(sourceSystem) {
        const normalized = normalizeParticleSystem(sourceSystem);

        if (!normalized) {
            return null;
        }

        const key = `particles:${normalized.cacheKey}`;

        if (!this.particleBuffers.has(key)) {
            const gl = this.gl;
            const buffer = {
                ...normalized,
                vao: gl.createVertexArray(),
                vbo: gl.createBuffer(),
            };

            gl.bindVertexArray(buffer.vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer.vbo);
            gl.bufferData(gl.ARRAY_BUFFER, buffer.data, gl.STATIC_DRAW);

            const stride = buffer.stride * 4;
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 3 * 4);
            gl.enableVertexAttribArray(2);
            gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 4 * 4);
            gl.bindVertexArray(null);

            this.particleBuffers.set(key, buffer);
        }

        return this.particleBuffers.get(key);
    }

    getRenderOverlayMesh(sourceMesh) {
        const mesh = this.getRenderMesh(sourceMesh);

        if (!mesh) {
            return null;
        }

        const key = `overlay:${mesh.cacheKey}`;

        if (!this.overlayMeshes.has(key)) {
            const gl = this.gl;
            const lineOverlay = buildOverlayGeometry(mesh);

            const overlay = {
                faceMesh: mesh,
                linePositions: lineOverlay.linePositions,
                lineCount: lineOverlay.lineCount,
                pointPositions: lineOverlay.pointPositions,
                pointCount: lineOverlay.pointCount,
            };

            overlay.faceVao = mesh.vao;
            overlay.lineVao = gl.createVertexArray();
            overlay.lineVbo = gl.createBuffer();

            gl.bindVertexArray(overlay.lineVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, overlay.lineVbo);
            gl.bufferData(gl.ARRAY_BUFFER, overlay.linePositions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);

            overlay.pointVao = gl.createVertexArray();
            overlay.pointVbo = gl.createBuffer();

            gl.bindVertexArray(overlay.pointVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, overlay.pointVbo);
            gl.bufferData(gl.ARRAY_BUFFER, overlay.pointPositions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * 4, 0);

            gl.bindVertexArray(null);
            this.overlayMeshes.set(key, overlay);
        }

        return this.overlayMeshes.get(key);
    }

    getImageTexture(entry, fallbackName = "white") {
        const image = textureImage(entry);

        if (!image) {
            return this.fallbackTextures[fallbackName] || this.fallbackTextures.white;
        }

        if (!this.textures.has(image)) {
            this.textures.set(image, createTexture(this.gl, image));
        }

        return this.textures.get(image);
    }

    setTexture(program, name, unit, entry, fallbackName = "white") {
        const gl = this.gl;
        const location = gl.getUniformLocation(program, name);

        if (location === null) {
            return;
        }

        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, this.getImageTexture(entry, fallbackName));
        gl.uniform1i(location, unit);
    }

    setUniforms(program, values) {
        const gl = this.gl;

        Object.entries(values).forEach(([name, value]) => {
            const location = gl.getUniformLocation(program, name);

            if (location === null) {
                return;
            }

            const isTypedArray =
                value instanceof Float32Array ||
                value instanceof Float64Array ||
                value instanceof Int32Array ||
                value instanceof Uint32Array ||
                value instanceof Uint16Array ||
                value instanceof Int16Array ||
                value instanceof Uint8Array ||
                value instanceof Int8Array;

            const isArrayLike = Array.isArray(value) || isTypedArray;

            try {
                if (value instanceof Float32Array && value.length === 16) {
                    gl.uniformMatrix4fv(location, false, value);
                    return;
                }

                if (value instanceof Float32Array && value.length === 9) {
                    gl.uniformMatrix3fv(location, false, value);
                    return;
                }

                if (isArrayLike && value.length === 4) {
                    gl.uniform4fv(location, value);
                    return;
                }

                if (isArrayLike && value.length === 3) {
                    gl.uniform3fv(location, value);
                    return;
                }

                if (isArrayLike && value.length === 2) {
                    gl.uniform2fv(location, value);
                    return;
                }

                if (INT_UNIFORMS.has(name)) {
                    gl.uniform1i(location, Math.trunc(Number(value) || 0));
                    return;
                }

                if (typeof value === "boolean") {
                    gl.uniform1f(location, value ? 1 : 0);
                    return;
                }

                if (typeof value === "number" || typeof value === "string") {
                    gl.uniform1f(location, Number(value) || 0);
                    return;
                }

                console.warn("Skipped unsupported uniform value:", name, value);
            } catch (error) {
                console.warn("Uniform upload failed:", {
                    name,
                    value,
                    valueType: value?.constructor?.name,
                    valueLength: value?.length,
                    error,
                });
            }
        });
    }

    buildMatrices(width, height, geometry, rotation) {
        const aspect = Math.max(width / Math.max(height, 1), 0.01);
        const projection = mat4Perspective(Math.PI / 4.2, aspect, 0.05, 30);
        const camera = [0, 0.18, 3.25];
        const view = mat4LookAt(camera, [0, 0, 0], [0, 1, 0]);
        const viewProj = mat4Multiply(projection, view);
        const scale = mat4Scale(
            toNumber(geometry?.width, 1) * toNumber(geometry?.scale_x, 1),
            toNumber(geometry?.height, 1) * toNumber(geometry?.scale_y, 1),
            toNumber(geometry?.depth, 1) * toNumber(geometry?.scale_z, 1)
        );
        const rx = mat4RotateX(-0.34 + (toNumber(geometry?.rotation_x, 0) * Math.PI / 180));
        const ry = mat4RotateY(rotation + (toNumber(geometry?.rotation_y, 0) * Math.PI / 180));
        const model = mat4Multiply(ry, mat4Multiply(rx, scale));

        return {
            model,
            viewProj,
            normalMatrix: mat3FromMat4(model),
            camera,
        };
    }

    drawParticlePass({ materialLayer, matrices, dpr, getTextureForSlotFace }) {
        const particles = this.getParticleBuffer(materialLayer.particle_system);

        if (!particles) {
            return false;
        }

        const gl = this.gl;
        const slotKey = particles.textureSlot || "baseColor";
        const particleTexture =
            getTextureForSlotFace?.(slotKey, "front") ||
            getTextureForSlotFace?.("baseColor", "front") ||
            null;

        gl.useProgram(this.particleProgram);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(particles.depthWrite);

        if (particles.blend === "additive" || particles.blend === "screen") {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        } else {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }

        this.setTexture(this.particleProgram, "uParticleMap", 0, particleTexture, "white");
        this.setUniforms(this.particleProgram, {
            uModel: matrices.model,
            uViewProj: matrices.viewProj,
            uDpr: dpr,
            uUseParticleMap: mapEnabled(true, particleTexture),
            uColor: particles.color,
            uAlpha: particles.alpha,
            uSoft: 1,
        });

        gl.bindVertexArray(particles.vao);
        gl.drawArrays(gl.POINTS, 0, particles.count);
        gl.bindVertexArray(null);
        gl.depthMask(true);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        return true;
    }

    drawOverlayPass({ previewOverlay, matrices, renderMesh = null }) {
        if (!previewOverlay || !this.overlayProgram) {
            return;
        }

        const showFaces = previewOverlay.faces === true;
        const showWireframe = previewOverlay.wireframe === true;
        const showVertices = previewOverlay.vertices === true;

        if (!showFaces && !showWireframe && !showVertices) {
            return;
        }

        const gl = this.gl;

        gl.useProgram(this.overlayProgram);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.disable(gl.CULL_FACE);

        // Overlay soll sichtbar bleiben, aber nicht die Tiefe kaputt schreiben.
        gl.depthMask(false);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-1, -1);

        this.setUniforms(this.overlayProgram, {
            uModel: matrices.model,
            uViewProj: matrices.viewProj,
            uPointSize: 4.5,
            uPointMode: 0,
            uColor: [1, 1, 1, 1],
        });

        const overlays = renderMesh
            ? [this.getRenderOverlayMesh(renderMesh)].filter(Boolean)
            : Object.keys(FACE_DEFS).map(faceName => this.getOverlayMesh(faceName));

        overlays.forEach((overlay, index) => {

            if (showFaces) {
                this.setUniforms(this.overlayProgram, {
                    uPointMode: 0,
                    uColor: index % 2 === 0
                        ? [0.38, 0.90, 1.0, 0.22]
                        : [0.72, 0.54, 1.0, 0.18],
                });

                gl.bindVertexArray(overlay.faceVao);
                gl.drawElements(
                    gl.TRIANGLES,
                    overlay.faceMesh.count,
                    overlay.faceMesh.indexType === "uint32" ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
                    0
                );
            }

            if (showWireframe) {
                this.setUniforms(this.overlayProgram, {
                    uPointMode: 0,
                    uColor: [0.38, 0.90, 1.0, 0.86],
                });

                gl.bindVertexArray(overlay.lineVao);
                gl.drawArrays(gl.LINES, 0, overlay.lineCount);
            }

            if (showVertices) {
                this.setUniforms(this.overlayProgram, {
                    uPointMode: 1,
                    uPointSize: 5.5,
                    uColor: [1.0, 1.0, 1.0, 0.96],
                });

                gl.bindVertexArray(overlay.pointVao);
                gl.drawArrays(gl.POINTS, 0, overlay.pointCount);

                this.setUniforms(this.overlayProgram, {
                    uPointMode: 1,
                    uPointSize: 8.5,
                    uColor: [0.38, 0.90, 1.0, 0.28],
                });

                gl.drawArrays(gl.POINTS, 0, overlay.pointCount);
            }
        });

        gl.bindVertexArray(null);
        gl.disable(gl.POLYGON_OFFSET_FILL);

        gl.depthMask(true);
        gl.depthFunc(gl.LEQUAL);
    }

    render(options) {
        if (!this.ready) {
            return false;
        }

        const {
            width,
            height,
            dpr,
            materialLayer,
            surface,
            light,
            objectTextureSettings,
            rotation,
            previewOverlay = {},
            resolveSurfaceForFace,
            getTextureForFace,
            getTextureForSlotFace,
        } = options;
        const gl = this.gl;
        const useObjectTextures = shouldUseObjectTextures(previewOverlay);
        const wireframeMaterialAlpha = previewOverlay?.wireframe === true ? 0.2 : 1;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (objectTextureSettings.backface_culling && !objectTextureSettings.show_backface) {
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
        } else {
            gl.disable(gl.CULL_FACE);
        }

        const matrices = this.buildMatrices(width, height, materialLayer.geometry || {}, rotation);
        const lightDirection = normalize3([
            toNumber(light.direction_x, -0.35),
            toNumber(light.direction_y, -0.65),
            toNumber(light.direction_z, 0.72),
        ]);
        const alphaMode = objectTextureSettings.alpha_mode === "OPAQUE"
            ? 0
            : objectTextureSettings.alpha_mode === "CLIP"
                ? 2
                : objectTextureSettings.alpha_mode === "HASHED"
                    ? 3
                    : 1;

        if (materialLayer.particle_system?.enabled === true) {
            return this.drawParticlePass({
                materialLayer,
                matrices,
                dpr,
                getTextureForSlotFace,
            });
        }

        gl.useProgram(this.program);

        const materialMesh = this.getRenderMesh(materialLayer.mesh);
        const drawEntries = materialMesh
            ? materialMesh.parts.map(part => ({
                faceName: part.faceName || part.materialSlot || part.name || "front",
                mesh: materialMesh,
                start: Math.max(0, Math.trunc(Number(part.start || 0))),
                count: Math.max(0, Math.trunc(Number(part.count || materialMesh.count))),
            }))
            : Object.keys(FACE_DEFS).map(faceName => ({
                faceName,
                mesh: this.getMesh(faceName),
                start: 0,
                count: 0,
            }));

        drawEntries.forEach(entry => {
            const faceName = entry.faceName;
            const faceSurface = resolveSurfaceForFace(surface, materialLayer, faceName);
            const slotTexture = slot => resolvePreviewTexture(
                useObjectTextures,
                () => getTextureForSlotFace(slot, faceName)
            );

            const baseTexture = resolvePreviewTexture(
                useObjectTextures,
                () => getTextureForFace(materialLayer, faceName)
            );

            const alphaTexture = slotTexture("alpha");

            const normalTexture =
                slotTexture("normal") ||
                slotTexture("clearcoatNormal");

            const displacementTexture =
                slotTexture("displacementStrength") ||
                slotTexture("displacement_strength");

            const bumpTexture =
                slotTexture("bumpStrength") ||
                slotTexture("bump_strength") ||
                displacementTexture;

            const roughnessTexture = slotTexture("roughness");
            const metallicTexture = slotTexture("metallic");
            const specularTexture = slotTexture("specular");

            const emissionTexture =
                slotTexture("emission") ||
                slotTexture("emission_color");

            const clearcoatTexture =
                slotTexture("clearcoat") ||
                slotTexture("clearcoatRoughness");

            const subsurfaceTexture = slotTexture("subsurface");
            const transmissionTexture = slotTexture("transmission");
            const transmissionRoughnessTexture = slotTexture("transmissionRoughness");
            const iorTexture = slotTexture("ior");
            const sheenTexture = slotTexture("sheen");
            const clearcoatRoughnessTexture = slotTexture("clearcoatRoughness");

            const slotParams = (...slotKeys) => {
                const slotKey = slotKeys.find(key => materialLayer.bitmap_maps?.[key]) || slotKeys[0];
                const slot = materialLayer.bitmap_maps?.[slotKey] || {};
                const texture = slotKeys.map(key => slotTexture(key)).find(Boolean) || {};

                return {
                    strength: Math.min(Math.max(toNumber(slot.strength ?? texture.strength, 1), -4), 4),
                    offset: Math.min(Math.max(toNumber(slot.offset ?? texture.offset, 0), -1), 1),
                    invert: slot.invert === true || texture.invert === true ? 1 : 0,
                };
            };
            const baseParams = slotParams("baseColor", "base_color");
            const alphaParams = slotParams("alpha");
            const roughnessParams = slotParams("roughness");
            const metallicParams = slotParams("metallic");
            const specularParams = slotParams("specular");
            const clearcoatParams = slotParams("clearcoat", "clearcoatRoughness");
            const subsurfaceParams = slotParams("subsurface");
            const transmissionParams = slotParams("transmission");
            const transmissionRoughnessParams = slotParams("transmissionRoughness");
            const iorParams = slotParams("ior");
            const sheenParams = slotParams("sheen");
            const clearcoatRoughnessParams = slotParams("clearcoatRoughness");
            const normalParams = slotParams("normal", "clearcoatNormal");
            const bumpParams = slotParams("bumpStrength", "bump_strength");
            const displacementParams = slotParams("displacementStrength", "displacement_strength");
            const hasDisplacementTexture = mapEnabled(useObjectTextures, displacementTexture) === 1;
            const hasBumpTexture = mapEnabled(useObjectTextures, slotTexture("bumpStrength")) === 1;

            const heightParams = hasDisplacementTexture && !hasBumpTexture
                ? displacementParams
                : bumpParams;
            const lightType = String(light.lightType || light.light_type || light.mode || "sun").toLowerCase();
            const lightTypeIndex = lightType === "directional"
                ? 1
                : lightType === "point"
                    ? 2
                    : lightType === "spot"
                        ? 3
                        : lightType === "area"
                            ? 4
                            : 0;
            if (alphaMode === 2 && clamp01(faceSurface.alpha) < objectTextureSettings.alpha_clip) {
                return;
            }

            this.setTexture(this.program, "uBaseMap", 0, baseTexture, "white");
            this.setTexture(this.program, "uAlphaMap", 1, alphaTexture, "white");
            this.setTexture(this.program, "uNormalMap", 2, normalTexture, "normal");
            this.setTexture(this.program, "uBumpMap", 3, bumpTexture, "black");
            this.setTexture(this.program, "uRoughnessMap", 4, roughnessTexture, "black");
            this.setTexture(this.program, "uMetallicMap", 5, metallicTexture, "black");
            this.setTexture(this.program, "uSpecularMap", 6, specularTexture, "white");
            this.setTexture(this.program, "uEmissionMap", 7, emissionTexture, "white");
            this.setTexture(this.program, "uClearcoatMap", 8, clearcoatTexture, "black");
            this.setTexture(this.program, "uDisplacementMap", 9, displacementTexture, "black");
            this.setTexture(this.program, "uSubsurfaceMap", 10, subsurfaceTexture, "black");
            this.setTexture(this.program, "uTransmissionMap", 11, transmissionTexture, "black");
            this.setTexture(this.program, "uTransmissionRoughnessMap", 12, transmissionRoughnessTexture, "black");
            this.setTexture(this.program, "uIorMap", 13, iorTexture, "black");
            this.setTexture(this.program, "uSheenMap", 14, sheenTexture, "black");
            this.setTexture(this.program, "uClearcoatRoughnessMap", 15, clearcoatRoughnessTexture, "black");

            this.setUniforms(this.program, {
                uModel: matrices.model,
                uViewProj: matrices.viewProj,
                uNormalMatrix: matrices.normalMatrix,
                uUseBaseMap: mapEnabled(useObjectTextures, baseTexture),
                uUseAlphaMap: mapEnabled(useObjectTextures, alphaTexture),
                uUseNormalMap: mapEnabled(useObjectTextures, normalTexture),
                uUseBumpMap: mapEnabled(useObjectTextures, bumpTexture),
                uUseRoughnessMap: mapEnabled(useObjectTextures, roughnessTexture),
                uUseMetallicMap: mapEnabled(useObjectTextures, metallicTexture),
                uUseSpecularMap: mapEnabled(useObjectTextures, specularTexture),
                uUseEmissionMap: mapEnabled(useObjectTextures, emissionTexture),
                uUseClearcoatMap: mapEnabled(useObjectTextures, clearcoatTexture),
                uUseSubsurfaceMap: mapEnabled(useObjectTextures, subsurfaceTexture),
                uUseTransmissionMap: mapEnabled(useObjectTextures, transmissionTexture),
                uUseTransmissionRoughnessMap: mapEnabled(useObjectTextures, transmissionRoughnessTexture),
                uUseIorMap: mapEnabled(useObjectTextures, iorTexture),
                uUseSheenMap: mapEnabled(useObjectTextures, sheenTexture),
                uUseClearcoatRoughnessMap: mapEnabled(useObjectTextures, clearcoatRoughnessTexture),
                uAlphaMode: alphaMode,
                uBaseColor: toColor4(faceSurface.baseColor),
                uSubsurfaceColor: toColor4(faceSurface.subsurfaceColor),
                uEmissionColor: toColor4(faceSurface.emission),
                uAlpha: (
                    objectTextureSettings.alpha_mode === "OPAQUE"
                        ? 1
                        : clamp01(faceSurface.alpha)
                ) * wireframeMaterialAlpha,
                uAlphaClip: toNumber(objectTextureSettings.alpha_clip, 0.5),
                uBaseStrength: baseParams.strength,
                uBaseOffset: baseParams.offset,
                uBaseInvert: baseParams.invert,
                uAlphaStrength: alphaParams.strength,
                uAlphaOffset: alphaParams.offset,
                uAlphaInvert: alphaParams.invert,
                uRoughness: clamp01(faceSurface.roughness),
                uRoughnessStrength: roughnessParams.strength,
                uRoughnessOffset: roughnessParams.offset,
                uRoughnessInvert: roughnessParams.invert,
                uMetallic: clamp01(faceSurface.metallic),
                uMetallicStrength: metallicParams.strength,
                uMetallicOffset: metallicParams.offset,
                uMetallicInvert: metallicParams.invert,
                uSpecular: clamp01(faceSurface.specular),
                uSpecularStrength: specularParams.strength,
                uSpecularOffset: specularParams.offset,
                uSpecularInvert: specularParams.invert,
                uSpecularTint: clamp01(faceSurface.specularTint),
                uIor: Math.min(Math.max(toNumber(faceSurface.ior, 1.45), 1), 4),
                uSubsurface: clamp01(faceSurface.subsurface),
                uSubsurfaceStrength: subsurfaceParams.strength,
                uSubsurfaceOffset: subsurfaceParams.offset,
                uSubsurfaceInvert: subsurfaceParams.invert,
                uSubsurfaceRadius: toColor3(faceSurface.subsurfaceRadius),
                uTransmission: clamp01(faceSurface.transmission),
                uTransmissionStrength: transmissionParams.strength,
                uTransmissionOffset: transmissionParams.offset,
                uTransmissionInvert: transmissionParams.invert,
                uTransmissionRoughness: clamp01(faceSurface.transmissionRoughness),
                uTransmissionRoughnessStrength: transmissionRoughnessParams.strength,
                uTransmissionRoughnessOffset: transmissionRoughnessParams.offset,
                uTransmissionRoughnessInvert: transmissionRoughnessParams.invert,
                uAnisotropic: clamp01(faceSurface.anisotropic),
                uAnisotropicRotation: clamp01(faceSurface.anisotropicRotation),
                uSheen: clamp01(faceSurface.sheen),
                uSheenStrength: sheenParams.strength,
                uSheenOffset: sheenParams.offset,
                uSheenInvert: sheenParams.invert,
                uSheenTint: clamp01(faceSurface.sheenTint),
                uClearcoat: clamp01(faceSurface.clearcoat),
                uClearcoatStrength: clearcoatParams.strength,
                uClearcoatOffset: clearcoatParams.offset,
                uClearcoatInvert: clearcoatParams.invert,
                uClearcoatRoughness: clamp01(faceSurface.clearcoatRoughness),
                uClearcoatRoughnessStrength: clearcoatRoughnessParams.strength,
                uClearcoatRoughnessOffset: clearcoatRoughnessParams.offset,
                uClearcoatRoughnessInvert: clearcoatRoughnessParams.invert,
                uEmissionStrength: Math.min(Math.max(toNumber(faceSurface.emissionStrength, 0), 0), 10),
                uNormalStrength: mapEnabled(useObjectTextures, normalTexture)
                    ? Math.min(Math.max(Math.abs(normalParams.strength), 0), 2)
                    : Math.max(clamp01(faceSurface.normal), clamp01(faceSurface.clearcoatNormal)),
                uNormalStrengthInput: normalParams.strength,
                uNormalInvert: normalParams.invert,
                uBumpStrength: mapEnabled(useObjectTextures, bumpTexture)
                    ? Math.min(Math.max(Math.abs(heightParams.strength), 0), 2) * 0.28
                    : clamp01(faceSurface.bumpStrength) * 0.2,
                uBumpStrengthInput: heightParams.strength,
                uBumpOffset: heightParams.offset,
                uBumpInvert: heightParams.invert,
                uDiffuseRoughness: clamp01(faceSurface.diffuseRoughness ?? faceSurface.diffuse_roughness),
                uSubsurfaceScale: Math.min(Math.max(toNumber(faceSurface.subsurfaceScale ?? faceSurface.subsurface_scale, 1), 0), 50),
                uSubsurfaceIor: Math.min(Math.max(toNumber(faceSurface.subsurfaceIor ?? faceSurface.subsurface_ior ?? faceSurface.ior, 1.45), 1), 4),
                uSubsurfaceAnisotropy: clamp01(faceSurface.subsurfaceAnisotropy ?? faceSurface.subsurface_anisotropy),
                uCoatIor: Math.min(Math.max(toNumber(faceSurface.coatIor ?? faceSurface.clearcoatIor ?? faceSurface.coat_ior, 1.5), 1), 2),
                uCoatTint: toColor3(faceSurface.coatTint || faceSurface.clearcoatTint || faceSurface.coat_tint || [1, 1, 1]),
                uSheenRoughness: clamp01(faceSurface.sheenRoughness ?? faceSurface.sheen_roughness ?? 0.5),
                uThinFilmThickness: Math.min(Math.max(toNumber(faceSurface.thinFilmThickness ?? faceSurface.thin_film_thickness, 0), 0), 1200),
                uThinFilmIor: Math.min(Math.max(toNumber(faceSurface.thinFilmIor ?? faceSurface.thin_film_ior, 1.33), 1), 2),
                uTangentStrength: clamp01(faceSurface.tangent),
                uIorStrength: iorParams.strength,
                uIorOffset: iorParams.offset,
                uIorInvert: iorParams.invert,
                uMaskThreshold: Math.min(Math.max(toNumber(materialLayer.settings?.mask_threshold ?? light.mask_threshold, 0.5), 0), 1),
                uCameraPos: matrices.camera,
                uLightType: lightTypeIndex,
                uLightPos: [
                    toNumber(light.position_x, 0),
                    toNumber(light.position_y, 1.4),
                    toNumber(light.position_z, 2.8),
                ],
                uLightDir: lightDirection,
                uLightColor: toHexColor3(light.color, [1, 0.96, 0.9]),
                uLightIntensity: light.enabled === false ? 0 : toNumber(light.intensity, 1) * 4.2,
                uLightRange: Math.min(Math.max(toNumber(light.range, 4), 0.001), 100),
                uLightDecay: Math.min(Math.max(toNumber(light.decay, 2), 0), 4),
                uLightRadius: Math.min(Math.max(toNumber(light.radius, 0.25), 0), 10),
                uInnerCone: Math.min(Math.max(toNumber(light.innerCone ?? light.inner_cone, 0.35), 0), 1),
                uOuterCone: Math.min(Math.max(toNumber(light.outerCone ?? light.outer_cone, 0.75), 0), 1),
                uAmbientColor: toHexColor3(light.ambient_color, [0.7, 0.78, 0.9]),
                uAmbientIntensity: light.enabled === false ? 1 : toNumber(light.ambient, 0.34),
                uEnvironmentColor: toHexColor3(light.environment_color, [0.72, 0.82, 1]),
                uReflectionIntensity: 1,
                uGlossIntensity: 1,
                uTransmissionLight: 1,
                uRimIntensity: 1,
                uExposure: 1,
                uContrast: 1,
                uScreenSpaceRefraction: objectTextureSettings.screen_space_refraction ? 1 : 0,
                uRefractionDepth: Math.min(Math.max(toNumber(objectTextureSettings.refraction_depth, 0), 0), 10),
                uSubsurfaceTranslucency: objectTextureSettings.subsurface_translucency ? 1 : 0,
            });

            const mesh = entry.mesh;
            const indexType = mesh.indexType === "uint32" ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            const indexBytes = indexType === gl.UNSIGNED_INT ? 4 : 2;
            const count = entry.count || mesh.count;
            const offset = entry.start * indexBytes;

            gl.bindVertexArray(mesh.vao);
            gl.drawElements(gl.TRIANGLES, count, indexType, offset);
        });

        this.drawOverlayPass({
            previewOverlay,
            matrices,
            renderMesh: materialMesh,
        });

        gl.bindVertexArray(null);

        return true;
    }

    destroy() {
        const gl = this.gl;

        if (!gl) {
            return;
        }

        this.meshes.forEach(mesh => {
            if (mesh.vao) gl.deleteVertexArray(mesh.vao);
            if (mesh.vbo) gl.deleteBuffer(mesh.vbo);
            if (mesh.ibo) gl.deleteBuffer(mesh.ibo);
        });

        this.overlayMeshes.forEach(mesh => {
            if (mesh.faceVao) gl.deleteVertexArray(mesh.faceVao);
            if (mesh.faceVbo) gl.deleteBuffer(mesh.faceVbo);
            if (mesh.faceIbo) gl.deleteBuffer(mesh.faceIbo);

            if (mesh.lineVao) gl.deleteVertexArray(mesh.lineVao);
            if (mesh.lineVbo) gl.deleteBuffer(mesh.lineVbo);
            if (mesh.pointVao) gl.deleteVertexArray(mesh.pointVao);
            if (mesh.pointVbo) gl.deleteBuffer(mesh.pointVbo);
        });

        this.particleBuffers.forEach(buffer => {
            if (buffer.vao) gl.deleteVertexArray(buffer.vao);
            if (buffer.vbo) gl.deleteBuffer(buffer.vbo);
        });

        Object.values(this.fallbackTextures || {}).forEach(texture => {
            if (texture) {
                gl.deleteTexture(texture);
            }
        });

        if (this.program) {
            gl.deleteProgram(this.program);
        }

        if (this.overlayProgram) {
            gl.deleteProgram(this.overlayProgram);
        }

        if (this.particleProgram) {
            gl.deleteProgram(this.particleProgram);
        }

        this.meshes.clear();
        this.overlayMeshes.clear();
        this.particleBuffers.clear();

        this.program = null;
        this.overlayProgram = null;
        this.particleProgram = null;
        this.ready = false;
    }
}
