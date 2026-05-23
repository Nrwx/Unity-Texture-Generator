import {Buffer} from "@/models/layer/3D/core/buffer/model";
import {clamp} from "@/utils/tools";
import {Matrix} from "@/view/models/page/material/core/Math/Matrix/Matrix";
import {Quaternion} from "@/view/models/page/material/core/Math/Quaternion/Quaternion";
import {CoordinateSystem} from "@/models/layer/3D/core/coordinate/model";
import {isFiniteNumber} from "@/utils/math";

const FACE_DEFS = Object.freeze({
    front: {
        normal: [0, -1, 0],
        tangent: [1, 0, 0],
        origin: [-0.5, -0.5, -0.5],
        u: [1, 0, 0],
        v: [0, 0, 1],
    },
    back: {
        normal: [0, 1, 0],
        tangent: [-1, 0, 0],
        origin: [0.5, 0.5, -0.5],
        u: [-1, 0, 0],
        v: [0, 0, 1],
    },
    left: {
        normal: [-1, 0, 0],
        tangent: [0, -1, 0],
        origin: [-0.5, 0.5, -0.5],
        u: [0, -1, 0],
        v: [0, 0, 1],
    },
    right: {
        normal: [1, 0, 0],
        tangent: [0, 1, 0],
        origin: [0.5, -0.5, -0.5],
        u: [0, 1, 0],
        v: [0, 0, 1],
    },
    top: {
        normal: [0, 0, 1],
        tangent: [1, 0, 0],
        origin: [-0.5, -0.5, 0.5],
        u: [1, 0, 0],
        v: [0, 1, 0],
    },
    bottom: {
        normal: [0, 0, -1],
        tangent: [1, 0, 0],
        origin: [-0.5, 0.5, -0.5],
        u: [1, 0, 0],
        v: [0, -1, 0],
    },
});

const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
layout(location = 3) in vec3 aTangent;
layout(location = 10) in vec4 iModel0;
layout(location = 11) in vec4 iModel1;
layout(location = 12) in vec4 iModel2;
layout(location = 13) in vec4 iModel3;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNormalMatrix;
uniform int uUseInstancing;
uniform float uMaskThreshold;

out vec2 vUv;
out vec3 vWorldPos;
out vec3 vNormal;
out vec3 vTangent;

void main() {
    vec3 pos = aPosition;
    mat4 model = uUseInstancing == 1
        ? mat4(iModel0, iModel1, iModel2, iModel3)
        : uModel;
    mat3 normalMatrix = uUseInstancing == 1
        ? mat3(model)
        : uNormalMatrix;

    vec4 world = model * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    vUv = aUv;
    vNormal = normalize(normalMatrix * aNormal);
    vTangent = normalize(normalMatrix * aTangent);

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
uniform int uAlphaMapSource;
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

        inputValue = dot(s.rgb, vec3(0.299, 0.587, 0.114));
        inputValue *= s.a;
    }

    float mapped = applySlotMath(inputValue, strength, offset, invertInput);

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
        float alphaLuma = dot(alphaTex.rgb, vec3(0.299, 0.587, 0.114));
        float alphaSource = uAlphaMapSource == 1 ? alphaTex.a : alphaLuma;
        alpha *= applySlotMath(
            alphaSource,
            uAlphaStrength,
            uAlphaOffset,
            uAlphaInvert
        );
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
    vec3 emissionColor = readSlotColor(
        uEmissionMap,
        vUv,
        uEmissionColor.rgb,
        uUseEmissionMap,
        1.0,
        0.0,
        0
    );
    
    vec3 emission = emissionColor * uEmissionStrength;

    vec3 color = ambient + light + reflection + emission;
    color *= 1.0 + emission.r * 0.04 + transmission * 0.08 + metallic * 0.05;
    color = color / (color + vec3(1.0));
    color = clamp((color - vec3(0.5)) * (1.0 + (1.0 - roughness) * 0.12 + metallic * 0.08) + vec3(0.5), vec3(0.0), vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, alpha);
}`;

const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 iPosition;
layout(location = 2) in float iSize;
layout(location = 3) in float iAlpha;
layout(location = 4) in float iRotation;
layout(location = 5) in vec2 iScale;
layout(location = 6) in vec4 iColor;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform float uDpr;
uniform vec2 uViewport;

out vec2 vUv;
out float vAlpha;
out vec4 vColor;

void main() {
    vec4 world = uModel * vec4(iPosition, 1.0);
    vec4 clip = uViewProj * world;

    float c = cos(iRotation);
    float s = sin(iRotation);
    vec2 corner = vec2(
        aCorner.x * c - aCorner.y * s,
        aCorner.x * s + aCorner.y * c
    );
    vec2 sizePx = max(vec2(1.0), iSize * uDpr * max(iScale, vec2(0.001))) * 0.5;
    vec2 viewport = max(uViewport, vec2(1.0));

    // Keep billboard size perspective-correct.
    // The previous screen-space offset multiplied by clip.w, so particles kept
    // their pixel size while zooming out and visually grew relative to the scene.
    // Offsetting clip.xy directly makes the final NDC offset shrink with distance
    // after the perspective divide, while orthographic cameras keep stable size.
    clip.xy += (corner * sizePx / viewport) * 2.0;

    gl_Position = clip;
    vUv = aCorner * 0.5 + 0.5;
    vAlpha = iAlpha;
    vColor = iColor;
}`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uParticleMap;
uniform int uUseParticleMap;
uniform vec4 uColor;
uniform float uAlpha;
uniform int uSoft;

in vec2 vUv;
in float vAlpha;
in vec4 vColor;
out vec4 fragColor;

void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float radial = 1.0 - smoothstep(0.72, 1.0, length(centered));
    vec4 texel = uUseParticleMap == 1 ? texture(uParticleMap, vUv) : vec4(1.0);
    vec4 particleColor = uColor * vColor;
    float alpha = texel.a * particleColor.a * uAlpha * vAlpha * (uSoft == 1 ? radial : 1.0);

    if (alpha <= 0.01) {
        discard;
    }

    fragColor = vec4(texel.rgb * particleColor.rgb, alpha);
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

const EDITOR_INSTANCED_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in float aT;
layout(location = 1) in vec4 iFromSize;
layout(location = 2) in vec4 iToMode;
layout(location = 3) in vec4 iColor;

uniform mat4 uViewProj;

out vec4 vColor;
flat out float vPointMode;

void main() {
    vec3 fromPoint = iFromSize.xyz;
    vec3 toPoint = iToMode.xyz;
    float pointMode = iToMode.w;
    vec3 position = pointMode > 0.5
        ? fromPoint
        : mix(fromPoint, toPoint, clamp(aT, 0.0, 1.0));

    gl_Position = uViewProj * vec4(position, 1.0);
    gl_PointSize = max(1.0, iFromSize.w);
    vColor = iColor;
    vPointMode = pointMode;
}`;

const EDITOR_INSTANCED_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 vColor;
flat in float vPointMode;
out vec4 fragColor;

void main() {
    if (vPointMode > 0.5) {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        if (dot(p, p) > 1.0) {
            discard;
        }
    }

    fragColor = vColor;
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

const toNumber = (value, fallback = 0) => isFiniteNumber(Number(value)) ? Number(value) : fallback;
const shouldRevealParticlesThroughSurface = ({ surface, baseTexture, alphaTexture }) => {
    return (
        clamp(surface?.alpha ?? 1) < 0.999 ||
        hasTexture(alphaTexture) ||
        hasTexture(baseTexture)
    );
};
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

const asVec3Array = (value, fallback = [0, 0, 0]) => {
    if (Array.isArray(value)) {
        return [
            toNumber(value[0], fallback[0]),
            toNumber(value[1], fallback[1]),
            toNumber(value[2], fallback[2]),
        ];
    }

    if (value && typeof value === "object") {
        return [
            toNumber(value.x, fallback[0]),
            toNumber(value.y, fallback[1]),
            toNumber(value.z, fallback[2]),
        ];
    }

    return fallback;
};

const clampNumber = (value, min, max, fallback = min) => {
    const number = toNumber(value, fallback);

    return Math.min(Math.max(number, min), max);
};

const resolveViewportCamera = ({
                                   materialLayer,
                                   viewportCamera,
                                   width,
                                   height,
                               }) => {
    const allowMaterialLayerCamera =
        materialLayer?.settings?.animator_viewport === true ||
        materialLayer?.preview?.animator_viewport === true ||
        materialLayer?.animator_viewport === true;

    const source =
        viewportCamera ||
        (
            allowMaterialLayerCamera
                ? (
                    materialLayer?.viewport_camera ||
                    materialLayer?.settings?.viewport_camera ||
                    materialLayer?.preview?.viewport_camera ||
                    materialLayer?.shader?.viewport_camera ||
                    materialLayer?.material?.viewport_camera
                )
                : null
        ) ||
        null;

    const aspect = Math.max(
        0.0001,
        toNumber(source?.aspect, width / Math.max(1, height))
    );

    if (!source || typeof source !== "object") {
        return CoordinateSystem.sceneToRendererCamera({
            enabled: false,
            projection: "perspective",
            aspect,
            fov: 42,
            near: 0.01,
            far: 1000,
            // Default material preview: front view with a small Z-up elevation.
            // Idle rotation spins the object around its mesh Z axis instead of
            // starting from an unintended top/isometric camera.
            position: [0, -4.5, 0.72],
            target: [0, 0, 0],
            up: [0, 0, 1],
            orthographicScale: 5,
        });
    }

    const projection = String(
        source.projection ||
        source.type ||
        "perspective"
    ).toLowerCase();

    const camera = {
        enabled: true,

        projection: projection === "orthographic" || projection === "ortho"
            ? "orthographic"
            : "perspective",

        aspect,

        fov: clampNumber(source.fov, 1, 175, 50),
        near: Math.max(0.0001, toNumber(source.near, 0.01)),
        far: Math.max(0.01, toNumber(source.far, 1000)),

        radius: Math.max(0.0001, toNumber(source.radius, 4.6)),

        orthographicScale: Math.max(
            0.0001,
            toNumber(
                source.orthographic_scale ??
                source.orthographicScale,
                5
            )
        ),

        position: asVec3Array(source.position, [0, -4.5, 0.72]),
        target: asVec3Array(source.target, [0, 0, 0]),
        up: normalize3(asVec3Array(source.up, [0, 0, 1])),
    };

    return CoordinateSystem.sceneToRendererCamera(camera);
};

const buildCameraMatrices = ({
                                 width,
                                 height,
                                 materialLayer,
                                 viewportCamera,
                             }) => {
    const cameraPayload = resolveViewportCamera({
        materialLayer,
        viewportCamera,
        width,
        height,
    });
    const aspect = Math.max(
        0.0001,
        cameraPayload.aspect || width / Math.max(1, height)
    );
    const view = Matrix.lookAt(
        cameraPayload.position,
        cameraPayload.target,
        cameraPayload.up
    );
    const projection = cameraPayload.projection === "orthographic"
        ? (() => {
            const halfHeight = cameraPayload.orthographicScale * 0.5;
            const halfWidth = halfHeight * aspect;

            return Matrix.orthographic(
                -halfWidth,
                halfWidth,
                -halfHeight,
                halfHeight,
                cameraPayload.near,
                cameraPayload.far
            );
        })()
        : Matrix.perspective(
            cameraPayload.fov * Math.PI / 180,
            aspect,
            cameraPayload.near,
            cameraPayload.far
        );
    const viewProj = projection
        .clone()
        .multiply(view);

    return {
        camera: cameraPayload,
        view: view.data,
        projection: projection.data,
        viewProj: viewProj.data,
        cameraPos: cameraPayload.position,
    };
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
const alphaSourceCache = new WeakMap();
const EDIT_VIEW_MODES = Object.freeze(new Set(["wireframe", "solid", "soft", "world"]));
const shouldUseObjectTextures = (previewOverlay, editor = {}) => {
    const viewMode = String(editor?.viewMode || "world").toLowerCase();

    if (EDIT_VIEW_MODES.has(viewMode) && viewMode !== "world") {
        return false;
    }

    return previewOverlay?.wireframe !== true;
};

const mapEnabled = (useObjectTextures, texture) => {
    return useObjectTextures && hasTexture(texture) ? 1 : 0;
};

const resolvePreviewTexture = (useObjectTextures, resolver) => {
    return useObjectTextures ? resolver() : null;
};
const resolveAlphaMapSource = texture => {
    const image = textureImage(texture);

    if (!image) {
        return 0;
    }

    if (alphaSourceCache.has(image)) {
        return alphaSourceCache.get(image);
    }

    const width = Math.max(1, Math.min(32, image.naturalWidth || image.width || 1));
    const height = Math.max(1, Math.min(32, image.naturalHeight || image.height || 1));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx) {
        alphaSourceCache.set(image, 0);
        return 0;
    }

    try {
        ctx.drawImage(image, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;

        for (let index = 3; index < data.length; index += 4) {
            if (data[index] < 250) {
                alphaSourceCache.set(image, 1);
                return 1;
            }
        }
    } catch (_error) {
        alphaSourceCache.set(image, 0);
        return 0;
    }

    alphaSourceCache.set(image, 0);
    return 0;
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

const renderMeshInstanceCache = new WeakMap();
const particleSystemInstanceCache = new WeakMap();
const EMPTY_FLOAT32 = new Float32Array();
const EMPTY_UINT16 = new Uint16Array();

const getArrayValues = value => {
    if (ArrayBuffer.isView(value) || Array.isArray(value)) {
        return value;
    }

    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort((a, b) => Number(a) - Number(b))
            .map(key => value[key]);
    }

    return [];
};

const arrayLikeLength = value => Number(value?.length || 0);

const makeRenderMeshSignature = mesh => {
    const vertices = mesh?.vertices;
    const indices = mesh?.indices;
    const parts = mesh?.parts;

    return [
        mesh?.meta?.renderCacheKey || mesh?.meta?.cacheKey || "",
        mesh?.meta?.version || mesh?.meta?.updatedAt || mesh?.version || mesh?.updatedAt || "",
        mesh?.id || "",
        mesh?.primitive || mesh?.settings?.primitive || "mesh",
        mesh?.stride || 11,
        arrayLikeLength(vertices),
        arrayLikeLength(indices),
        Array.isArray(parts) ? parts.length : 0,
        mesh?.indexType || "",
    ].join(":");
};

const toFloat32Values = value => {
    if (value instanceof Float32Array) {
        return value;
    }

    const source = getArrayValues(value);

    if (!source.length) {
        return EMPTY_FLOAT32;
    }

    const target = new Float32Array(source.length);

    for (let index = 0; index < source.length; index += 1) {
        target[index] = Number(source[index]) || 0;
    }

    return target;
};

const toIndexValues = (value, indexType = "") => {
    if (value instanceof Uint16Array || value instanceof Uint32Array) {
        return value;
    }

    const source = getArrayValues(value);

    if (!source.length) {
        return EMPTY_UINT16;
    }

    let maxIndex = 0;
    const normalized = new Array(source.length);

    for (let index = 0; index < source.length; index += 1) {
        const value = Math.max(0, Math.trunc(Number(source[index]) || 0));
        normalized[index] = value;
        if (value > maxIndex) {
            maxIndex = value;
        }
    }

    const TargetArray = indexType === "uint32" || maxIndex > 65535
        ? Uint32Array
        : Uint16Array;

    return new TargetArray(normalized);
};

const getInstancedParts = (mesh, count) => (
    Array.isArray(mesh?.parts) && mesh.parts.length
        ? mesh.parts.map(part => ({
            ...part,
            start: Math.max(0, Math.trunc(Number(part.start || 0))),
            count: Math.max(0, Math.trunc(Number(part.count || count))),
        }))
        : [{
            name: "mesh",
            faceName: "front",
            start: 0,
            count,
        }]
);

const normalizeRenderMesh = mesh => {
    if (!mesh || !mesh.stride || !mesh.vertices || !mesh.indices) {
        return null;
    }

    const signature = makeRenderMeshSignature(mesh);
    const cached = renderMeshInstanceCache.get(mesh);

    if (cached?.signature === signature) {
        return cached.normalized;
    }

    const stride = Math.max(1, Math.trunc(Number(mesh.stride || 11)));
    const vertices = toFloat32Values(mesh.vertices);
    const indices = toIndexValues(mesh.indices, mesh.indexType);

    if (stride < 8 || vertices.length < stride * 3 || indices.length < 3) {
        return null;
    }

    const normalized = {
        id: mesh.id || "material-mesh",
        primitive: mesh.primitive || mesh.settings?.primitive || "mesh",
        stride,
        vertices,
        indices,
        count: indices.length,
        indexType: indices instanceof Uint32Array ? "uint32" : "uint16",
        parts: getInstancedParts(mesh, indices.length),
        cacheKey: mesh.meta?.renderCacheKey || mesh.meta?.cacheKey || signature,
        instanceKey: signature,
    };

    renderMeshInstanceCache.set(mesh, {
        signature,
        normalized,
    });

    return normalized;
};

const makeParticleSignature = system => {
    const particles = system?.particles || {};
    const data = particles.data;
    const positions = particles.positions;

    return [
        system?.id || "particle-system",
        system?.version || system?.updatedAt || system?.tick || "",
        particles.version || particles.updatedAt || particles.tick || "",
        system?.seed || 0,
        system?.age || 0,
        system?.time || 0,
        system?.count || particles.count || 0,
        particles.sourceCount || "",
        particles.stride || 12,
        arrayLikeLength(data),
        arrayLikeLength(positions),
        system?.texture_slot || "baseColor",
        system?.blend || "alpha",
        system?.alpha ?? 1,
    ].join(":");
};

const clamp01 = value => Math.min(Math.max(Number(value) || 0, 0), 1);

const normalizeParticleSystem = system => {
    if (!system || system.enabled !== true) {
        return null;
    }

    const signature = makeParticleSignature(system);
    const cached = particleSystemInstanceCache.get(system);

    if (cached?.signature === signature) {
        return cached.normalized;
    }

    const particles = system.particles || {};
    const packedData = particles.data instanceof Float32Array && particles.data.length > 0
        ? particles.data
        : null;
    const stride = Math.max(12, Math.trunc(Number(particles.stride || 12)));
    const sourceCount = Math.max(0, Math.trunc(Number(particles.count || system.count || 0)));
    const count = packedData
        ? Math.min(sourceCount, Math.floor(packedData.length / stride))
        : (() => {
            const positions = getArrayValues(particles.positions);
            return Math.min(sourceCount, Math.floor(positions.length / 3));
        })();

    if (!count) {
        return null;
    }

    let data = packedData;

    if (!data) {
        const positions = getArrayValues(particles.positions);
        const sizes = getArrayValues(particles.sizes);
        const scales = getArrayValues(particles.scales);
        const alphas = getArrayValues(particles.alphas);
        const rotations = getArrayValues(particles.rotations);
        const colors = getArrayValues(particles.colors);
        data = new Float32Array(count * stride);

        for (let index = 0; index < count; index += 1) {
            const source = index * 3;
            const target = index * stride;

            data[target] = Number(positions[source] || 0);
            data[target + 1] = Number(positions[source + 1] || 0);
            data[target + 2] = Number(positions[source + 2] || 0);
            data[target + 3] = Math.max(1, Number(sizes[index] || system.size || 12));
            data[target + 4] = clamp01(alphas[index] ?? system.alpha ?? 1);
            data[target + 5] = Number(rotations[index] ?? ((Number(system.rotation) || 0) * Math.PI / 180)) || 0;
            data[target + 6] = Math.min(Math.max(Number(scales[index * 2] ?? 1), 0.001), 1);
            data[target + 7] = Math.min(Math.max(Number(scales[index * 2 + 1] ?? 1), 0.001), 1);
            data[target + 8] = clamp01(colors[index * 4] ?? 1);
            data[target + 9] = clamp01(colors[index * 4 + 1] ?? 1);
            data[target + 10] = clamp01(colors[index * 4 + 2] ?? 1);
            data[target + 11] = clamp01(colors[index * 4 + 3] ?? 1);
        }
    }

    const normalized = {
        id: system.id || "particle-system",
        count,
        data,
        stride,
        textureSlot: system.texture_slot || "baseColor",
        color: toColor4(system.color || [1, 1, 1, system.alpha ?? 1]),
        alpha: clamp01(system.alpha ?? 1),
        blend: system.blend || "alpha",
        depthWrite: system.depth_write === true,
        cacheKey: signature,
    };

    particleSystemInstanceCache.set(system, {
        signature,
        normalized,
    });

    return normalized;
};

const createParticleLayerSystem = (particleSystem, layer, index = 0) => {
    if (!layer?.particles) {
        return null;
    }

    const layerId = layer.id || layer.key || `layer-${index}`;
    const settings = layer.settings || {};

    return {
        ...particleSystem,
        ...settings,
        id: `${particleSystem?.id || "particle-system"}:${layerId}`,
        particles: layer.particles,
        layers: null,
        count: layer.count || layer.particles?.count || settings.count || particleSystem?.count,
        alpha: layer.alpha ?? settings.alpha ?? particleSystem?.alpha,
        color: layer.color || settings.color || particleSystem?.color,
        texture_slot: layer.texture_slot || settings.texture_slot || particleSystem?.texture_slot,
        blend: layer.blend || settings.blend || particleSystem?.blend,
        version: layer.version || layer.updatedAt || layer.tick || particleSystem?.version,
    };
};

const INT_UNIFORMS = Object.freeze(new Set([
    "uUseInstancing",
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
    "uAlphaMapSource",
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
            preserveDrawingBuffer: true,
        });
        this.ready = false;
        this.program = null;
        this.overlayProgram = null;
        this.editorInstancedProgram = null;
        this.particleProgram = null;

        this.meshes = new Map();
        this.overlayMeshes = new Map();
        this.particleBuffers = new Map();
        this.meshInstanceScratch = new Float32Array(16);
        this.editorBuffers = new Map();
        this.editorInstancedBuffers = new Map();
        this.editorInstanceScratch = {
            line: new Float32Array(12 * 512),
            point: new Float32Array(12 * 512),
        };
        this.uniformLocations = new WeakMap();

        this.textures = new WeakMap();
        this.fallbackTextures = {};

        if (!this.gl) {
            return;
        }

        this.program = createProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);
        this.overlayProgram = createProgram(this.gl, OVERLAY_VERTEX_SHADER, OVERLAY_FRAGMENT_SHADER);
        this.editorInstancedProgram = createProgram(this.gl, EDITOR_INSTANCED_VERTEX_SHADER, EDITOR_INSTANCED_FRAGMENT_SHADER);
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

            mesh.buffer = Buffer.materialMesh(this.gl, mesh, {
                label: `face:${faceName}`,
                instanceStride: 16 * 4,
                instanceUsage: this.gl.DYNAMIC_DRAW,
                instanceAttributes: [
                    { location: 10, size: 4, offset: 0, divisor: 1 },
                    { location: 11, size: 4, offset: 4 * 4, divisor: 1 },
                    { location: 12, size: 4, offset: 8 * 4, divisor: 1 },
                    { location: 13, size: 4, offset: 12 * 4, divisor: 1 },
                ],
            });

            this.meshes.set(faceName, mesh);
        }

        return this.meshes.get(faceName);
    }

    getOverlayMesh(faceName) {
        if (!this.overlayMeshes.has(faceName)) {
            const faceMesh = buildFaceQuadMesh(faceName);
            const lineMesh = buildCoarseFaceMesh(faceName, 8);
            const pointMesh = lineMesh;

            const lineOverlay = buildOverlayGeometry(lineMesh);
            const pointOverlay = buildOverlayGeometry(pointMesh);

            const overlay = {
                faceMesh,
                lineCount: lineOverlay.lineCount,
                pointCount: pointOverlay.pointCount,

                faceBuffer: Buffer.materialMesh(this.gl, faceMesh, {
                    label: `overlay-face:${faceName}`,
                }),

                lineBuffer: Buffer.positions(this.gl, lineOverlay.linePositions, {
                    label: `overlay-line:${faceName}`,
                }),

                pointBuffer: Buffer.positions(this.gl, pointOverlay.pointPositions, {
                    label: `overlay-points:${faceName}`,
                }),
            };

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
        const cached = this.meshes.get(key);

        if (cached?.buffer && cached.instanceKey === normalized.instanceKey) {
            return cached;
        }

        if (cached?.buffer) {
            cached.buffer.destroy?.();
            this.meshes.delete(key);
        }

        const mesh = {
            ...normalized,
            buffer: Buffer.materialMesh(this.gl, normalized, {
                label: key,
                instanceStride: 16 * 4,
                instanceUsage: this.gl.DYNAMIC_DRAW,
                instanceAttributes: [
                    { location: 10, size: 4, offset: 0, divisor: 1 },
                    { location: 11, size: 4, offset: 4 * 4, divisor: 1 },
                    { location: 12, size: 4, offset: 8 * 4, divisor: 1 },
                    { location: 13, size: 4, offset: 12 * 4, divisor: 1 },
                ],
            }),
        };

        this.meshes.set(key, mesh);
        return mesh;
    }

    createParticleBuffer(key, normalized) {
        const quad = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1,
        ]);
        const instanceCapacity = Math.max(1024, Math.pow(2, Math.ceil(Math.log2(Math.max(1, normalized.count)))));
        const buffer = {
            ...normalized,
            buffer: new Buffer(this.gl, {
                label: key,
                stride: 2 * 4,
                indexed: false,
                usage: this.gl.STATIC_DRAW,
                instanceStride: 12 * 4,
                instanceUsage: this.gl.DYNAMIC_DRAW,
                attributes: [
                    { location: 0, size: 2, offset: 0 },
                ],
                instanceAttributes: [
                    { location: 1, size: 3, offset: 0, divisor: 1 },
                    { location: 2, size: 1, offset: 3 * 4, divisor: 1 },
                    { location: 3, size: 1, offset: 4 * 4, divisor: 1 },
                    { location: 4, size: 1, offset: 5 * 4, divisor: 1 },
                    { location: 5, size: 2, offset: 6 * 4, divisor: 1 },
                    { location: 6, size: 4, offset: 8 * 4, divisor: 1 },
                ],
            }),
        };

        buffer.buffer.upload({
            vertices: quad,
        });
        buffer.buffer.createInstanceBuffer({
            stride: 12 * 4,
            capacity: instanceCapacity,
            usage: this.gl.DYNAMIC_DRAW,
        });
        buffer.buffer.updateInstances(
            normalized.data,
            normalized.count,
            this.gl.DYNAMIC_DRAW
        );

        return buffer;
    }

    getParticleBuffer(system) {
        const normalized = normalizeParticleSystem(system);

        if (!normalized) {
            return null;
        }

        const key = `particles:${normalized.id}`;
        let buffer = this.particleBuffers.get(key);

        if (!buffer || buffer.stride !== normalized.stride || !buffer.buffer) {
            buffer = this.createParticleBuffer(key, normalized);
            this.particleBuffers.set(key, buffer);
            return buffer;
        }

        if (buffer.cacheKey !== normalized.cacheKey || buffer.data !== normalized.data || buffer.count !== normalized.count) {
            Object.assign(buffer, {
                ...normalized,
                buffer: buffer.buffer,
            });

            buffer.buffer.updateInstances(
                normalized.data,
                normalized.count,
                this.gl.DYNAMIC_DRAW
            );
        }

        return buffer;
    }

    updateMeshInstance(mesh, matrices) {
        if (!mesh?.buffer || !matrices?.model) {
            return;
        }

        const source = matrices.model;
        const target = this.meshInstanceScratch;

        for (let index = 0; index < 16; index += 1) {
            target[index] = Number(source[index]) || 0;
        }

        if (!mesh.buffer.instanceVbo) {
            mesh.buffer.createInstanceBuffer({
                stride: 16 * 4,
                capacity: 1,
                usage: this.gl.DYNAMIC_DRAW,
            });
        }

        mesh.buffer.updateInstances(target, 1, this.gl.DYNAMIC_DRAW);
    }

    getRenderOverlayMesh(sourceMesh) {
        const mesh = this.getRenderMesh(sourceMesh);

        if (!mesh) {
            return null;
        }

        const key = `overlay:${mesh.cacheKey}`;

        if (!this.overlayMeshes.has(key)) {
            const lineOverlay = buildOverlayGeometry(mesh);

            const overlay = {
                faceMesh: mesh,
                lineCount: lineOverlay.lineCount,
                pointCount: lineOverlay.pointCount,

                // Face nutzt denselben Render-Mesh-Buffer.
                faceBuffer: mesh.buffer,

                lineBuffer: Buffer.positions(this.gl, lineOverlay.linePositions, {
                    label: `${key}:lines`,
                }),

                pointBuffer: Buffer.positions(this.gl, lineOverlay.pointPositions, {
                    label: `${key}:points`,
                }),
            };

            this.overlayMeshes.set(key, overlay);
        }

        return this.overlayMeshes.get(key);
    }

    getUniformLocation(program, name) {
        if (!program || !name) {
            return null;
        }

        let cache = this.uniformLocations.get(program);

        if (!cache) {
            cache = new Map();
            this.uniformLocations.set(program, cache);
        }

        if (!cache.has(name)) {
            cache.set(name, this.gl.getUniformLocation(program, name));
        }

        return cache.get(name);
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
        const location = this.getUniformLocation(program, name);

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
            const location = this.getUniformLocation(program, name);

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

    buildMatrices(width, height, geometry, rotation = 0, materialLayer = null, viewportCamera = null) {
        const rendererGeometry = CoordinateSystem.sceneToRendererGeometry(geometry || {});

        const position = Matrix.translation(
            toNumber(rendererGeometry?.position_x, 0),
            toNumber(rendererGeometry?.position_y, 0),
            toNumber(rendererGeometry?.position_z, 0)
        );

        const pivot = Matrix.translation(
            toNumber(rendererGeometry?.pivot_x, 0),
            toNumber(rendererGeometry?.pivot_y, 0),
            toNumber(rendererGeometry?.pivot_z, 0)
        );

        const inversePivot = Matrix.translation(
            -toNumber(rendererGeometry?.pivot_x, 0),
            -toNumber(rendererGeometry?.pivot_y, 0),
            -toNumber(rendererGeometry?.pivot_z, 0)
        );

        const scale = Matrix.scale(
            toNumber(rendererGeometry?.width, 1) * toNumber(rendererGeometry?.scale_x, 1),
            toNumber(rendererGeometry?.height, 1) * toNumber(rendererGeometry?.scale_y, 1),
            toNumber(rendererGeometry?.depth, 1) * toNumber(rendererGeometry?.scale_z, 1)
        );

        const previewIdleEnabled = !viewportCamera && (
            materialLayer?.preview?.idle_rotation?.enabled === true ||
            materialLayer?.preview?.rotate === true ||
            materialLayer?.settings?.rotate_preview === true
        );
        const previewTilt = previewIdleEnabled
            ? toNumber(materialLayer?.preview?.idle_rotation?.tilt, 0.42)
            : 0;

        // Keep the material preview tilt as a fixed view/object presentation offset.
        // The idle spin must stay on the mesh Z axis; otherwise the tilt is baked into
        // the animated rotation and the cube appears to wobble into a top/iso view.
        const previewTiltMatrix = Matrix.fromQuaternion(Quaternion.fromAxisAngle([1, 0, 0], previewTilt));

        const rx = Matrix.fromQuaternion(Quaternion.fromAxisAngle([1, 0, 0],
            toNumber(rendererGeometry?.rotation_x, 0) * Math.PI / 180
        ));

        const ry = Matrix.fromQuaternion(Quaternion.fromAxisAngle([0, 1, 0],
            toNumber(rendererGeometry?.rotation_y, 0) * Math.PI / 180
        ));

        const rz = Matrix.fromQuaternion(Quaternion.fromAxisAngle([0, 0, 1],
            toNumber(rotation, 0) +
            toNumber(rendererGeometry?.rotation_z, 0) * Math.PI / 180
        ));

        const model = position
            .multiply(pivot)
            .multiply(previewTiltMatrix)
            .multiply(rz)
            .multiply(ry)
            .multiply(rx)
            .multiply(scale)
            .multiply(inversePivot)
            .toArray();

        const cameraMatrices = buildCameraMatrices({
            width,
            height,
            materialLayer,
            viewportCamera,
        });

        return {
            model,
            viewProj: cameraMatrices.viewProj,
            normalMatrix: mat3FromMat4(model),

            // Wichtig:
            // Bestehende Render-Pfade nutzen teils "camera",
            // der Shader braucht aber uCameraPos.
            camera: cameraMatrices.cameraPos,
            cameraPos: cameraMatrices.cameraPos,

            viewportCamera: cameraMatrices.camera,
        };
    }

    drawParticlePass({ materialLayer, matrices, dpr, getTextureForSlotFace, getParticleTextureForLayer, ignoreDepth = false }) {
        const particles = this.getParticleBuffer(materialLayer.particle_system);

        if (!particles) {
            return false;
        }

        const gl = this.gl;
        const slotKey = particles.textureSlot || "baseColor";
        const fallbackTexture =
            getTextureForSlotFace?.(slotKey, "front") ||
            getTextureForSlotFace?.("baseColor", "front") ||
            null;
        const renderLayers = Array.isArray(materialLayer.particle_system?.layers) && materialLayer.particle_system.layers.length
            ? materialLayer.particle_system.layers
            : [null];

        gl.useProgram(this.particleProgram);
        gl.disable(gl.CULL_FACE);
        if (ignoreDepth) {
            gl.disable(gl.DEPTH_TEST);
        }
        gl.depthMask(particles.depthWrite);

        if (particles.blend === "additive" || particles.blend === "screen") {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        } else {
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }

        this.setUniforms(this.particleProgram, {
            uModel: matrices.model,
            uViewProj: matrices.viewProj,
            uDpr: dpr,
            uViewport: [this.canvas.width || 1, this.canvas.height || 1],
            uColor: particles.color,
            uAlpha: particles.alpha,
            uSoft: 1,
        });

        renderLayers.forEach((layer, index) => {
            const layerSystem = createParticleLayerSystem(materialLayer.particle_system, layer, index);
            const layerParticles = layerSystem
                ? this.getParticleBuffer(layerSystem)
                : particles;

            if (!layerParticles || layerParticles.count <= 0) {
                return;
            }

            const particleTexture = getParticleTextureForLayer?.(layer) || fallbackTexture;

            this.setTexture(this.particleProgram, "uParticleMap", 0, particleTexture, "white");
            this.setUniforms(this.particleProgram, {
                uColor: layerParticles.color || particles.color,
                uAlpha: layerParticles.alpha ?? particles.alpha,
                uUseParticleMap: mapEnabled(true, particleTexture),
            });

            layerParticles.buffer?.drawArraysInstanced(
                gl.TRIANGLES,
                6,
                0,
                layerParticles.count
            );
        });
        gl.bindVertexArray(null);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        if (ignoreDepth) {
            gl.enable(gl.DEPTH_TEST);
        }
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

        // Mesh topology overlay belongs to the object, not to the editor gizmo.
        // Keep depth testing enabled so it does not wash over the whole orbit.
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
                        ? [0.38, 0.90, 1.0, 0.34]
                        : [0.72, 0.54, 1.0, 0.30],
                });

                overlay.faceBuffer?.drawElements(
                    gl.TRIANGLES,
                    overlay.faceMesh.count || overlay.faceBuffer.indexCount,
                    0
                );
            }

            if (showWireframe) {
                this.setUniforms(this.overlayProgram, {
                    uPointMode: 0,
                    uColor: [0.38, 0.90, 1.0, 0.86],
                });

                // Fix: Wireframe muss über den Line-Buffer laufen,
                // nicht über den Triangle/Face-Buffer.
                overlay.lineBuffer?.drawArrays(
                    gl.LINES,
                    overlay.lineCount
                );
            }

            if (showVertices) {
                // Glow / Außenpunkt zuerst, größer und sichtbarer.
                this.setUniforms(this.overlayProgram, {
                    uPointMode: 1,
                    uPointSize: 10.5,
                    uColor: [0.38, 0.90, 1.0, 0.42],
                });

                overlay.pointBuffer?.drawArrays(gl.POINTS, overlay.pointCount);

                // Heller Kern darüber.
                this.setUniforms(this.overlayProgram, {
                    uPointMode: 1,
                    uPointSize: 6.25,
                    uColor: [1.0, 1.0, 1.0, 1.0],
                });

                overlay.pointBuffer?.drawArrays(gl.POINTS, overlay.pointCount);
            }
        });

        gl.bindVertexArray(null);
        gl.disable(gl.POLYGON_OFFSET_FILL);

        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
    }


    buildEditorEntries(editor = {}, materialLayer = null) {
        const entries = [];
        const pushLineEntry = (key, color, positions, pointMode = 0, pointSize = 5.5, overlay = false) => {
            if (!positions.length) return;
            entries.push({ key, primitive: "LINES", pointMode, pointSize, color, overlay, positions });
        };
        const pushPointEntry = (key, color, positions, pointSize = 12.0, overlay = false) => {
            if (!positions.length) return;
            entries.push({ key, primitive: "POINTS", pointMode: 1, pointSize, color, overlay, positions });
        };
        const pushSceneLine = (target, a, b) => {
            target.push(...CoordinateSystem.sceneToRendererVector(a), ...CoordinateSystem.sceneToRendererVector(b));
        };
        const point = value => ([
            toNumber(value?.x ?? value?.[0], 0),
            toNumber(value?.y ?? value?.[1], 0),
            toNumber(value?.z ?? value?.[2], 0),
        ]);

        const grid = editor.grid || {};
        const size = Math.max(1, toNumber(grid.size, 12));
        const divisions = Math.max(2, Math.trunc(toNumber(grid.divisions, 24)));
        const majorEvery = Math.max(1, Math.trunc(toNumber(grid.majorEvery, 4)));
        const step = size / divisions;
        const half = size * 0.5;

        if (editor.renderGrid !== false) {
            const minor = [];
            const major = [];
            for (let index = 0; index <= divisions; index += 1) {
                const target = index % majorEvery === 0 ? major : minor;
                const value = -half + index * step;
                pushSceneLine(target, [-half, value, 0], [half, value, 0]);
                pushSceneLine(target, [value, -half, 0], [value, half, 0]);
            }
            pushLineEntry("grid:minor", [0.58, 0.66, 0.82, 0.22], minor);
            pushLineEntry("grid:major", [0.72, 0.82, 1.0, 0.42], major);
        }

        const geometry = materialLayer?.geometry || materialLayer?.mesh?.settings || {};
        const objectPivot = [
            toNumber(geometry.position_x, 0) + toNumber(geometry.pivot_x, 0),
            toNumber(geometry.position_y, 0) + toNumber(geometry.pivot_y, 0),
            toNumber(geometry.position_z, 0) + toNumber(geometry.pivot_z, 0),
        ];
        const origin = point(editor.gizmoOrigin || editor.pivotPoint || objectPivot);
        const gizmoSize = Math.max(0.16, Math.min(0.92, toNumber(editor.gizmoSize, 0.72)));
        const activeTool = String(editor.tool || "translate").toLowerCase();
        const activeAxis = String(editor.axis || "free").toLowerCase();
        const axisColors = {
            x: [1.0, 0.18, 0.16, 1.0],
            y: [0.25, 1.0, 0.45, 1.0],
            z: [0.35, 0.58, 1.0, 1.0],
        };
        const axisDirs = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
        const lineTo = (axis, amount) => [origin[0] + axis[0] * amount, origin[1] + axis[1] * amount, origin[2] + axis[2] * amount];

        if (editor.renderWorldAxis === true) {
            const axisSize = Math.max(0.5, Math.min(2.5, half * 0.3));
            Object.entries(axisDirs).forEach(([axis, dir]) => {
                const line = [];
                pushSceneLine(line, [0, 0, 0], [dir[0] * axisSize, dir[1] * axisSize, dir[2] * axisSize]);
                pushLineEntry(`world-axis:${axis}`, axisColors[axis], line, 0, 4.5);
            });
        }

        if (editor.renderPivot !== false) {
            const drawPivot = (key, pivotPoint, color, pointSize = 8.5) => {
                const pivot = [];
                const s = Math.max(0.03, gizmoSize * 0.075);
                pushSceneLine(pivot, [pivotPoint[0] - s, pivotPoint[1], pivotPoint[2]], [pivotPoint[0] + s, pivotPoint[1], pivotPoint[2]]);
                pushSceneLine(pivot, [pivotPoint[0], pivotPoint[1] - s, pivotPoint[2]], [pivotPoint[0], pivotPoint[1] + s, pivotPoint[2]]);
                pushSceneLine(pivot, [pivotPoint[0], pivotPoint[1], pivotPoint[2] - s], [pivotPoint[0], pivotPoint[1], pivotPoint[2] + s]);
                pushLineEntry(`pivot:${key}:cross`, color, pivot, 0, 5.25, true);
                pushPointEntry(`pivot:${key}:point`, color, CoordinateSystem.sceneToRendererVector(pivotPoint), pointSize, true);
            };

            if (editor.showObjectPivot !== false) {
                drawPivot("object", point(editor.objectPivotPoint || objectPivot), [1.0, 0.78, 0.28, 1.0], 8.5);
            }

            if (editor.showWorldPivot !== false) {
                // World pivot is the immutable scene origin. It is never moved by mesh transforms.
                drawPivot("world", [0, 0, 0], [0.72, 0.86, 1.0, 0.82], 7.0);
            }

            if (editor.pivotMode === "cursor" && editor.cursorPivotActive === true) {
                drawPivot("cursor", point(editor.cursorPivot), [1.0, 0.48, 0.9, 0.95], 8.0);
            }
        }

        if (editor.renderGizmo !== false) {
            if ((activeTool === "translate" || activeTool === "pivot") && editor.showAxisHandles !== false) {
                Object.entries(axisDirs).forEach(([axis, dir]) => {
                    const line = [];
                    const tip = lineTo(dir, gizmoSize);
                    pushSceneLine(line, origin, tip);
                    pushLineEntry(`gizmo:translate:${axis}`, axisColors[axis], line, 0, 7.0, true);
                    pushPointEntry(`gizmo:translate-tip:${axis}`, axisColors[axis], CoordinateSystem.sceneToRendererVector(tip), 13.5, true);
                });
            }

            if (activeTool === "scale" && editor.showScaleHandles !== false) {
                Object.entries(axisDirs).forEach(([axis, dir]) => {
                    const line = [];
                    const tip = lineTo(dir, gizmoSize * 0.82);
                    pushSceneLine(line, origin, tip);
                    pushLineEntry(`gizmo:scale:${axis}`, axisColors[axis], line, 0, 7.0, true);
                    pushPointEntry(`gizmo:scale-box:${axis}`, axisColors[axis], CoordinateSystem.sceneToRendererVector(tip), 15.0, true);
                });
                pushPointEntry("gizmo:scale:free", [1.0, 1.0, 1.0, 1.0], CoordinateSystem.sceneToRendererVector(origin), 11.0, true);

                const triangle = [];
                const pushTriangleEdge = (a, b) => pushSceneLine(triangle, a, b);
                const activeDir = axisDirs[activeAxis];

                if (activeDir) {
                    const sideAxis = activeAxis === "x" ? axisDirs.y : axisDirs.x;
                    const heightAxis = activeAxis === "z" ? axisDirs.y : axisDirs.z;
                    const p0 = origin;
                    const p1 = lineTo(activeDir, gizmoSize * 0.62);
                    const p2 = [
                        p1[0] + sideAxis[0] * gizmoSize * 0.16 + heightAxis[0] * gizmoSize * 0.16,
                        p1[1] + sideAxis[1] * gizmoSize * 0.16 + heightAxis[1] * gizmoSize * 0.16,
                        p1[2] + sideAxis[2] * gizmoSize * 0.16 + heightAxis[2] * gizmoSize * 0.16,
                    ];
                    pushTriangleEdge(p0, p1);
                    pushTriangleEdge(p1, p2);
                    pushTriangleEdge(p2, p0);
                    pushLineEntry(`gizmo:scale-triangle:${activeAxis}`, [1.0, 1.0, 1.0, 0.78], triangle, 0, 3.0, true);
                } else {
                    const px = lineTo(axisDirs.x, gizmoSize * 0.48);
                    const py = lineTo(axisDirs.y, gizmoSize * 0.48);
                    const pz = lineTo(axisDirs.z, gizmoSize * 0.48);
                    pushTriangleEdge(px, py);
                    pushTriangleEdge(py, pz);
                    pushTriangleEdge(pz, px);
                    pushLineEntry("gizmo:scale-triangle:free", [1.0, 1.0, 1.0, 0.72], triangle, 0, 3.0, true);
                }
            }

            if (editor.renderPlaneHandles === true && activeTool === "translate") {
                const planeLine = (name, u, v, color) => {
                    const s = gizmoSize * 0.25;
                    const p0 = [origin[0] + u[0] * s + v[0] * s, origin[1] + u[1] * s + v[1] * s, origin[2] + u[2] * s + v[2] * s];
                    const p1 = [origin[0] + u[0] * s * 1.7 + v[0] * s, origin[1] + u[1] * s * 1.7 + v[1] * s, origin[2] + u[2] * s * 1.7 + v[2] * s];
                    const p2 = [origin[0] + u[0] * s * 1.7 + v[0] * s * 1.7, origin[1] + u[1] * s * 1.7 + v[1] * s * 1.7, origin[2] + u[2] * s * 1.7 + v[2] * s * 1.7];
                    const p3 = [origin[0] + u[0] * s + v[0] * s * 1.7, origin[1] + u[1] * s + v[1] * s * 1.7, origin[2] + u[2] * s + v[2] * s * 1.7];
                    const positions = [];
                    pushSceneLine(positions, p0, p1);
                    pushSceneLine(positions, p1, p2);
                    pushSceneLine(positions, p2, p3);
                    pushSceneLine(positions, p3, p0);
                    pushLineEntry(`gizmo:plane:${name}`, color, positions, 0, 4.5, true);
                };
                planeLine("xy", [1, 0, 0], [0, 1, 0], [1.0, 0.9, 0.22, 0.64]);
                planeLine("xz", [1, 0, 0], [0, 0, 1], [0.9, 0.45, 1.0, 0.64]);
                planeLine("yz", [0, 1, 0], [0, 0, 1], [0.35, 1.0, 1.0, 0.64]);
            }

            if (activeTool === "rotate" && editor.showRotateRings !== false) {
                const ring = (name, normalAxis, color) => {
                    const positions = [];
                    const steps = 96;
                    const radius = gizmoSize * 0.88;
                    for (let index = 0; index < steps; index += 1) {
                        const a0 = (index / steps) * Math.PI * 2;
                        const a1 = ((index + 1) / steps) * Math.PI * 2;
                        let p0; let p1;
                        if (normalAxis === "x") {
                            p0 = [origin[0], origin[1] + Math.cos(a0) * radius, origin[2] + Math.sin(a0) * radius];
                            p1 = [origin[0], origin[1] + Math.cos(a1) * radius, origin[2] + Math.sin(a1) * radius];
                        } else if (normalAxis === "y") {
                            p0 = [origin[0] + Math.cos(a0) * radius, origin[1], origin[2] + Math.sin(a0) * radius];
                            p1 = [origin[0] + Math.cos(a1) * radius, origin[1], origin[2] + Math.sin(a1) * radius];
                        } else {
                            p0 = [origin[0] + Math.cos(a0) * radius, origin[1] + Math.sin(a0) * radius, origin[2]];
                            p1 = [origin[0] + Math.cos(a1) * radius, origin[1] + Math.sin(a1) * radius, origin[2]];
                        }
                        pushSceneLine(positions, p0, p1);
                    }
                    pushLineEntry(`gizmo:rotate:${name}`, color, positions, 0, 5.75, true);
                };
                ring("x", "x", [1.0, 0.18, 0.16, 0.86]);
                ring("y", "y", [0.25, 1.0, 0.45, 0.86]);
                ring("z", "z", [0.35, 0.58, 1.0, 0.88]);
            }

            if (editor.dragging === true && editor.showAxisGuide !== false && axisDirs[activeAxis]) {
                const guide = [];
                const d = axisDirs[activeAxis];
                const amount = gizmoSize * 3.0;
                pushSceneLine(guide, lineTo(d, -amount), lineTo(d, amount));
                pushLineEntry(`gizmo:active-guide:${activeAxis}`, [1, 1, 1, 0.78], guide, 0, 3.0, true);
            }
        }



        if (editor.meshEdit?.enabled === true) {
            const meshEdit = editor.meshEdit;
            const selectedVertexColor = [1.0, 0.86, 0.25, 1.0];
            const vertexColor = [0.48, 0.78, 1.0, 0.92];
            const selectedEdgeColor = [1.0, 0.76, 0.22, 1.0];
            const edgeColor = [0.42, 0.88, 1.0, 0.72];
            const selectedFaceColor = [1.0, 0.72, 0.26, Math.max(0.24, toNumber(meshEdit.faceAlpha, 0.22))];
            const faceColor = [0.25, 0.62, 1.0, Math.max(0.14, toNumber(meshEdit.faceAlpha, 0.18))];
            const mode = String(meshEdit.mode || "vertex");
            const collectPoints = (items, selected) => {
                const positions = [];

                (items || []).forEach(item => {
                    if (selected === true && item.selected !== true) return;
                    if (selected === false && item.selected === true) return;
                    positions.push(...CoordinateSystem.sceneToRendererVector(item.point));
                });

                return positions;
            };
            const collectEdges = (items, selected) => {
                const positions = [];

                (items || []).forEach(item => {
                    if (selected === true && item.selected !== true) return;
                    if (selected === false && item.selected === true) return;
                    if (!Array.isArray(item.points) || item.points.length < 2) return;
                    pushSceneLine(positions, item.points[0], item.points[1]);
                });

                return positions;
            };
            const collectFaceEdges = (items, selected) => {
                const positions = [];

                (items || []).forEach(item => {
                    if (selected === true && item.selected !== true) return;
                    if (selected === false && item.selected === true) return;
                    if (!Array.isArray(item.points) || item.points.length < 3) return;
                    pushSceneLine(positions, item.points[0], item.points[1]);
                    pushSceneLine(positions, item.points[1], item.points[2]);
                    pushSceneLine(positions, item.points[2], item.points[0]);
                });

                return positions;
            };

            if (meshEdit.showFaces !== false && (mode === "face" || meshEdit.showAll === true)) {
                pushLineEntry("mesh-edit:faces", faceColor, collectFaceEdges(meshEdit.faces, false), 0, 2.5, false);
                pushLineEntry("mesh-edit:faces:selected", selectedFaceColor, collectFaceEdges(meshEdit.faces, true), 0, 5.0, true);
            }

            if (meshEdit.showEdges !== false && (mode === "edge" || mode === "face" || meshEdit.showAll === true)) {
                pushLineEntry("mesh-edit:edges", edgeColor, collectEdges(meshEdit.edges, false), 0, toNumber(meshEdit.edgeWidth, 2), false);
                pushLineEntry("mesh-edit:edges:selected", selectedEdgeColor, collectEdges(meshEdit.edges, true), 0, Math.max(4, toNumber(meshEdit.edgeWidth, 2) * 2.2), true);
            }

            if (meshEdit.showVertices !== false && (mode === "vertex" || meshEdit.showAll === true)) {
                pushPointEntry("mesh-edit:vertices", vertexColor, collectPoints(meshEdit.vertices, false), toNumber(meshEdit.vertexSize, 7.5), true);
                pushPointEntry("mesh-edit:vertices:selected", selectedVertexColor, collectPoints(meshEdit.vertices, true), Math.max(10, toNumber(meshEdit.vertexSize, 7.5) * 1.45), true);
            }
        }


        if (editor.sculptBrush?.enabled === true && Array.isArray(editor.sculptBrush.point)) {
            const brush = editor.sculptBrush;
            const center = point(brush.point);
            const radius = Math.max(0.001, toNumber(brush.radius, 0.18));
            const softness = Math.max(0, Math.min(1, toNumber(brush.softness, 0.68)));
            const color = Array.isArray(brush.color) ? brush.color : [0.82, 0.58, 1.0, 0.9];
            const softColor = [color[0], color[1], color[2], Math.max(0.18, color[3] * 0.42)];
            const normal = point(brush.normal || [0, 0, 1]);
            const nLength = Math.hypot(normal[0], normal[1], normal[2]) || 1;
            const n = [normal[0] / nLength, normal[1] / nLength, normal[2] / nLength];
            const fallback = Math.abs(n[2]) > 0.85 ? [1, 0, 0] : [0, 0, 1];
            const tangent = [
                n[1] * fallback[2] - n[2] * fallback[1],
                n[2] * fallback[0] - n[0] * fallback[2],
                n[0] * fallback[1] - n[1] * fallback[0],
            ];
            const tLength = Math.hypot(tangent[0], tangent[1], tangent[2]) || 1;
            const u = [tangent[0] / tLength, tangent[1] / tLength, tangent[2] / tLength];
            const v = [
                n[1] * u[2] - n[2] * u[1],
                n[2] * u[0] - n[0] * u[2],
                n[0] * u[1] - n[1] * u[0],
            ];
            const buildCircle = circleRadius => {
                const positions = [];
                const steps = 64;

                for (let index = 0; index < steps; index += 1) {
                    const a0 = (index / steps) * Math.PI * 2;
                    const a1 = ((index + 1) / steps) * Math.PI * 2;
                    const p0 = [
                        center[0] + (u[0] * Math.cos(a0) + v[0] * Math.sin(a0)) * circleRadius,
                        center[1] + (u[1] * Math.cos(a0) + v[1] * Math.sin(a0)) * circleRadius,
                        center[2] + (u[2] * Math.cos(a0) + v[2] * Math.sin(a0)) * circleRadius,
                    ];
                    const p1 = [
                        center[0] + (u[0] * Math.cos(a1) + v[0] * Math.sin(a1)) * circleRadius,
                        center[1] + (u[1] * Math.cos(a1) + v[1] * Math.sin(a1)) * circleRadius,
                        center[2] + (u[2] * Math.cos(a1) + v[2] * Math.sin(a1)) * circleRadius,
                    ];

                    pushSceneLine(positions, p0, p1);
                }

                return positions;
            };

            pushLineEntry("sculpt:brush-radius", color, buildCircle(radius), 0, 3.75, true);
            pushLineEntry("sculpt:brush-softness", softColor, buildCircle(radius * Math.max(0.05, 1 - softness * 0.72)), 0, 2.25, true);
            pushPointEntry("sculpt:brush-center", color, CoordinateSystem.sceneToRendererVector(center), 7.0, true);
        }

        return entries;
    }

    getEditorInstanceScratch(kind, instanceCount) {
        const key = kind === "point" ? "point" : "line";
        const required = Math.max(1, Math.trunc(Number(instanceCount || 1))) * 12;
        const current = this.editorInstanceScratch[key];

        if (current && current.length >= required) {
            return current;
        }

        let capacity = current?.length || 12;
        while (capacity < required) {
            capacity *= 2;
        }

        this.editorInstanceScratch[key] = new Float32Array(capacity);
        return this.editorInstanceScratch[key];
    }

    getEditorInstancedBuffer(kind) {
        const key = kind === "point" ? "point" : "line";

        if (this.editorInstancedBuffers.has(key)) {
            return this.editorInstancedBuffers.get(key);
        }

        const gl = this.gl;
        const vertices = key === "point"
            ? new Float32Array([0])
            : new Float32Array([0, 1]);
        const buffer = new Buffer(gl, {
            label: `editor-instanced:${key}`,
            stride: 4,
            indexed: false,
            usage: gl.STATIC_DRAW,
            attributes: [
                { location: 0, size: 1, offset: 0, stride: 4 },
            ],
            instanceStride: 12 * 4,
            instanceUsage: gl.DYNAMIC_DRAW,
            instanceAttributes: [
                { location: 1, size: 4, offset: 0, divisor: 1 },
                { location: 2, size: 4, offset: 4 * 4, divisor: 1 },
                { location: 3, size: 4, offset: 8 * 4, divisor: 1 },
            ],
        });

        buffer.upload({ vertices });
        buffer.createInstanceBuffer({
            capacity: key === "point" ? 1024 : 2048,
            usage: gl.DYNAMIC_DRAW,
        });

        const entry = {
            kind: key,
            vertexCount: key === "point" ? 1 : 2,
            primitive: key === "point" ? gl.POINTS : gl.LINES,
            buffer,
        };

        this.editorInstancedBuffers.set(key, entry);
        return entry;
    }

    buildEditorInstanceData(entry) {
        const positions = entry.positions;
        const isPoint = entry.primitive === "POINTS" || entry.pointMode === 1;
        const stride = 12;
        const count = isPoint
            ? Math.floor(positions.length / 3)
            : Math.floor(positions.length / 6);

        if (!count) {
            return null;
        }

        const data = this.getEditorInstanceScratch(isPoint ? "point" : "line", count);
        const color = entry.color || [1, 1, 1, 1];
        const size = Math.max(1, toNumber(entry.pointSize, isPoint ? 8 : 1));
        const pointMode = isPoint ? 1 : 0;

        for (let index = 0; index < count; index += 1) {
            const source = isPoint ? index * 3 : index * 6;
            const target = index * stride;
            const x = positions[source] || 0;
            const y = positions[source + 1] || 0;
            const z = positions[source + 2] || 0;
            const tx = isPoint ? x : positions[source + 3] || 0;
            const ty = isPoint ? y : positions[source + 4] || 0;
            const tz = isPoint ? z : positions[source + 5] || 0;

            data[target] = x;
            data[target + 1] = y;
            data[target + 2] = z;
            data[target + 3] = size;
            data[target + 4] = tx;
            data[target + 5] = ty;
            data[target + 6] = tz;
            data[target + 7] = pointMode;
            data[target + 8] = color[0] ?? 1;
            data[target + 9] = color[1] ?? 1;
            data[target + 10] = color[2] ?? 1;
            data[target + 11] = color[3] ?? 1;
        }

        return {
            count,
            kind: isPoint ? "point" : "line",
            data: data.subarray(0, count * stride),
        };
    }

    drawEditorPass({ editor = {}, matrices, materialLayer = null }) {
        if (editor.enabled !== true || !this.editorInstancedProgram) {
            return;
        }

        const entries = this.buildEditorEntries(editor, materialLayer);

        if (!entries.length) {
            return;
        }

        const gl = this.gl;

        gl.useProgram(this.editorInstancedProgram);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);

        this.setUniforms(this.editorInstancedProgram, {
            uViewProj: matrices.viewProj,
        });

        entries.forEach(entry => {
            const instance = this.buildEditorInstanceData(entry);

            if (!instance?.count) {
                return;
            }

            if (entry.overlay === true) {
                // Screen-readable handles and edit selections stay on top.
                gl.disable(gl.DEPTH_TEST);
            } else {
                gl.enable(gl.DEPTH_TEST);
                gl.depthFunc(gl.LEQUAL);
            }

            const batch = this.getEditorInstancedBuffer(instance.kind);
            batch.buffer.updateInstances(instance.data, instance.count, gl.DYNAMIC_DRAW);
            batch.buffer.drawArraysInstanced(
                batch.primitive,
                batch.vertexCount,
                0,
                instance.count
            );
        });

        gl.bindVertexArray(null);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
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

            // Animator / World-Orbit Camera
            viewportCamera = null,

            previewOverlay = {},
            resolveSurfaceForFace,
            getTextureForFace,
            getTextureForSlotFace,
            getAlphaTextureForFace,
            getParticleTextureForLayer,
            editor = {},
        } = options;

        const gl = this.gl;
        const editorViewMode = String(editor?.viewMode || "world").toLowerCase();
        const editSolidView = editor?.meshEdit?.enabled === true || editor?.sculptBrush?.enabled === true;
        const useObjectTextures = shouldUseObjectTextures(previewOverlay, editor);
        const wireframeMaterialAlpha = editorViewMode === "wireframe" ? 0.08 : previewOverlay?.wireframe === true ? 0.2 : 1;

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

        const matrices = this.buildMatrices(
            width,
            height,
            materialLayer.geometry || {},
            rotation,
            materialLayer,
            viewportCamera
        );

        const cameraPos = matrices.cameraPos || matrices.camera || [-1.7236637240151509, 1.7236637240151513, 3.901021242319559];

        const lightDirection = normalize3(CoordinateSystem.sceneToRendererVector([
            toNumber(light.direction_x, -0.35),
            toNumber(light.direction_y, -0.65),
            toNumber(light.direction_z, 0.72),
        ]));

        const alphaMode = objectTextureSettings.alpha_mode === "OPAQUE"
            ? 0
            : objectTextureSettings.alpha_mode === "CLIP"
                ? 2
                : objectTextureSettings.alpha_mode === "HASHED"
                    ? 3
                    : 1;

        const volumeLayeredPreview = materialLayer.particle_system?.enabled === true && (
            materialLayer.geometry?.volume?.enabled === true ||
            materialLayer.mesh?.volume?.enabled === true ||
            materialLayer.geometry?.fluid?.enabled === true ||
            materialLayer.mesh?.fluid?.enabled === true
        );

        const showFluidMesh =
            materialLayer.preview?.fluid_mesh !== false &&
            materialLayer.settings?.fluid_mesh_preview !== false;

        const showFluidParticles =
            materialLayer.preview?.fluid_particles !== false &&
            materialLayer.settings?.fluid_particle_preview !== false;

        if (materialLayer.particle_system?.enabled === true && !volumeLayeredPreview) {
            return this.drawParticlePass({
                materialLayer,
                matrices,
                dpr,
                getTextureForSlotFace,
                getParticleTextureForLayer,
            });
        }

        if (volumeLayeredPreview && !showFluidMesh) {
            if (showFluidParticles) {
                return this.drawParticlePass({
                    materialLayer,
                    matrices,
                    dpr,
                    getTextureForSlotFace,
                    getParticleTextureForLayer,
                    ignoreDepth: true,
                });
            }

            return true;
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

        const revealParticlesThroughVolumeAlpha = volumeLayeredPreview && showFluidParticles && drawEntries.some(entry => {
            const faceName = entry.faceName;
            const faceSurface = resolveSurfaceForFace(surface, materialLayer, faceName);

            const baseTexture = resolvePreviewTexture(
                useObjectTextures,
                () => getTextureForFace(materialLayer, faceName)
            );

            const alphaTexture = resolvePreviewTexture(
                useObjectTextures,
                () => getAlphaTextureForFace?.(materialLayer, faceName) || getTextureForSlotFace("alpha", faceName)
            );

            return shouldRevealParticlesThroughSurface({
                surface: faceSurface,
                baseTexture,
                alphaTexture,
            });
        });

        if (revealParticlesThroughVolumeAlpha) {
            this.drawParticlePass({
                materialLayer,
                matrices,
                dpr,
                getTextureForSlotFace,
                getParticleTextureForLayer,
                ignoreDepth: true,
            });

            gl.useProgram(this.program);
        }

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

            const alphaTexture = resolvePreviewTexture(
                useObjectTextures,
                () => getAlphaTextureForFace?.(materialLayer, faceName) || getTextureForSlotFace("alpha", faceName)
            );

            const revealFaceAlpha = volumeLayeredPreview && shouldRevealParticlesThroughSurface({
                surface: faceSurface,
                baseTexture,
                alphaTexture,
            });

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

            const textureParams = (slotKey, texture) => {
                const slot = materialLayer.bitmap_maps?.[slotKey] || {};

                return {
                    strength: Math.min(Math.max(toNumber(slot.strength ?? texture?.strength, 1), -4), 4),
                    offset: Math.min(Math.max(toNumber(slot.offset ?? texture?.offset, 0), -1), 1),
                    invert: slot.invert === true || texture?.invert === true ? 1 : 0,
                };
            };

            const baseParams = slotParams("baseColor", "base_color");
            const alphaParams = textureParams("alpha", alphaTexture);
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

            const lightType = String(light.lightType || "sun").toLowerCase();

            const lightTypeIndex = lightType === "directional"
                ? 1
                : lightType === "point"
                    ? 2
                    : lightType === "spot"
                        ? 3
                        : lightType === "area"
                            ? 4
                            : 0;

            if (alphaMode === 2 && clamp(faceSurface.alpha) < objectTextureSettings.alpha_clip) {
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
                uUseInstancing: 1,

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

                uBaseColor: toColor4(editSolidView && editorViewMode !== "world"
                    ? (editorViewMode === "soft" ? [0.28, 0.62, 1.0, 1] : editorViewMode === "solid" ? [0.58, 0.64, 0.72, 1] : [0.35, 0.48, 0.62, 1])
                    : faceSurface.baseColor),
                uSubsurfaceColor: toColor4(faceSurface.subsurfaceColor),
                uEmissionColor: toColor4(faceSurface.emission),

                uAlpha: (
                    objectTextureSettings.alpha_mode === "OPAQUE" && !revealFaceAlpha
                        ? 1
                        : clamp(faceSurface.alpha)
                ) * wireframeMaterialAlpha,

                uAlphaClip: toNumber(objectTextureSettings.alpha_clip, 0.5),

                uBaseStrength: baseParams.strength,
                uBaseOffset: baseParams.offset,
                uBaseInvert: baseParams.invert,

                uAlphaStrength: alphaParams.strength,
                uAlphaOffset: alphaParams.offset,
                uAlphaInvert: alphaParams.invert,
                uAlphaMapSource: resolveAlphaMapSource(alphaTexture),

                uRoughness: clamp(faceSurface.roughness),
                uRoughnessStrength: roughnessParams.strength,
                uRoughnessOffset: roughnessParams.offset,
                uRoughnessInvert: roughnessParams.invert,

                uMetallic: clamp(faceSurface.metallic),
                uMetallicStrength: metallicParams.strength,
                uMetallicOffset: metallicParams.offset,
                uMetallicInvert: metallicParams.invert,

                uSpecular: clamp(faceSurface.specular),
                uSpecularStrength: specularParams.strength,
                uSpecularOffset: specularParams.offset,
                uSpecularInvert: specularParams.invert,
                uSpecularTint: clamp(faceSurface.specularTint),

                uIor: Math.min(Math.max(toNumber(faceSurface.ior, 1.45), 1), 4),

                uSubsurface: clamp(faceSurface.subsurface),
                uSubsurfaceStrength: subsurfaceParams.strength,
                uSubsurfaceOffset: subsurfaceParams.offset,
                uSubsurfaceInvert: subsurfaceParams.invert,
                uSubsurfaceRadius: toColor3(faceSurface.subsurfaceRadius),

                uTransmission: clamp(faceSurface.transmission),
                uTransmissionStrength: transmissionParams.strength,
                uTransmissionOffset: transmissionParams.offset,
                uTransmissionInvert: transmissionParams.invert,

                uTransmissionRoughness: clamp(faceSurface.transmissionRoughness),
                uTransmissionRoughnessStrength: transmissionRoughnessParams.strength,
                uTransmissionRoughnessOffset: transmissionRoughnessParams.offset,
                uTransmissionRoughnessInvert: transmissionRoughnessParams.invert,

                uAnisotropic: clamp(faceSurface.anisotropic),
                uAnisotropicRotation: clamp(faceSurface.anisotropicRotation),

                uSheen: clamp(faceSurface.sheen),
                uSheenStrength: sheenParams.strength,
                uSheenOffset: sheenParams.offset,
                uSheenInvert: sheenParams.invert,
                uSheenTint: clamp(faceSurface.sheenTint),

                uClearcoat: clamp(faceSurface.clearcoat),
                uClearcoatStrength: clearcoatParams.strength,
                uClearcoatOffset: clearcoatParams.offset,
                uClearcoatInvert: clearcoatParams.invert,

                uClearcoatRoughness: clamp(faceSurface.clearcoatRoughness),
                uClearcoatRoughnessStrength: clearcoatRoughnessParams.strength,
                uClearcoatRoughnessOffset: clearcoatRoughnessParams.offset,
                uClearcoatRoughnessInvert: clearcoatRoughnessParams.invert,

                uEmissionStrength: Math.min(Math.max(toNumber(faceSurface.emissionStrength, 0), 0), 10),

                uNormalStrength: mapEnabled(useObjectTextures, normalTexture)
                    ? Math.min(Math.max(Math.abs(normalParams.strength), 0), 2)
                    : Math.max(clamp(faceSurface.normal), clamp(faceSurface.clearcoatNormal)),

                uNormalStrengthInput: normalParams.strength,
                uNormalInvert: normalParams.invert,

                uBumpStrength: mapEnabled(useObjectTextures, bumpTexture)
                    ? Math.min(Math.max(Math.abs(heightParams.strength), 0), 2) * 0.28
                    : clamp(faceSurface.bumpStrength) * 0.2,

                uBumpStrengthInput: heightParams.strength,
                uBumpOffset: heightParams.offset,
                uBumpInvert: heightParams.invert,

                uDiffuseRoughness: clamp(faceSurface.diffuseRoughness ?? faceSurface.diffuse_roughness),

                uSubsurfaceScale: Math.min(
                    Math.max(toNumber(faceSurface.subsurfaceScale ?? faceSurface.subsurface_scale, 1), 0),
                    50
                ),

                uSubsurfaceIor: Math.min(
                    Math.max(toNumber(faceSurface.subsurfaceIor ?? faceSurface.subsurface_ior ?? faceSurface.ior, 1.45), 1),
                    4
                ),

                uSubsurfaceAnisotropy: clamp(faceSurface.subsurfaceAnisotropy ?? faceSurface.subsurface_anisotropy),

                uCoatIor: Math.min(
                    Math.max(toNumber(faceSurface.coatIor ?? faceSurface.clearcoatIor ?? faceSurface.coat_ior, 1.5), 1),
                    2
                ),

                uCoatTint: toColor3(
                    faceSurface.coatTint ||
                    faceSurface.clearcoatTint ||
                    faceSurface.coat_tint ||
                    [1, 1, 1]
                ),

                uSheenRoughness: clamp(faceSurface.sheenRoughness ?? faceSurface.sheen_roughness ?? 0.5),

                uThinFilmThickness: Math.min(
                    Math.max(toNumber(faceSurface.thinFilmThickness ?? faceSurface.thin_film_thickness, 0), 0),
                    1200
                ),

                uThinFilmIor: Math.min(
                    Math.max(toNumber(faceSurface.thinFilmIor ?? faceSurface.thin_film_ior, 1.33), 1),
                    2
                ),

                uTangentStrength: clamp(faceSurface.tangent),

                uIorStrength: iorParams.strength,
                uIorOffset: iorParams.offset,
                uIorInvert: iorParams.invert,

                uMaskThreshold: Math.min(
                    Math.max(toNumber(materialLayer.settings?.mask_threshold ?? light.mask_threshold, 0.5), 0),
                    1
                ),

                // Wichtig: Animator / World-Orbit Kamera
                uCameraPos: cameraPos,

                uLightType: lightTypeIndex,

                uLightPos: CoordinateSystem.sceneToRendererVector([
                    toNumber(light.position_x, 0),
                    toNumber(light.position_y, 1.4),
                    toNumber(light.position_z, 2.8),
                ]),

                uLightDir: lightDirection,
                uLightColor: toHexColor3(light.color, [1, 0.96, 0.9]),

                uLightIntensity: light.enabled === false
                    ? 0
                    : toNumber(light.intensity, 1) * 4.2,

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

            if (!mesh?.buffer) {
                return;
            }

            const indexType = mesh.buffer.indexType;
            const indexBytes = indexType === gl.UNSIGNED_INT ? 4 : 2;
            const count = entry.count || mesh.count;
            const offset = entry.start * indexBytes;

            this.updateMeshInstance(mesh, matrices);

            if (mesh.buffer.drawElementsInstanced) {
                mesh.buffer.drawElementsInstanced(gl.TRIANGLES, count, offset, 1);
            } else {
                mesh.buffer.drawElements(gl.TRIANGLES, count, offset);
            }
        });

        this.drawOverlayPass({
            previewOverlay,
            matrices,
            renderMesh: materialMesh,
        });

        this.drawEditorPass({
            editor,
            matrices,
            materialLayer,
        });

        gl.bindVertexArray(null);

        if (volumeLayeredPreview && showFluidParticles) {
            this.drawParticlePass({
                materialLayer,
                matrices,
                dpr,
                getTextureForSlotFace,
                getParticleTextureForLayer,
                ignoreDepth: false,
            });
        }

        return true;
    }

    destroy() {
        const gl = this.gl;

        if (!gl) {
            return;
        }

        const destroyedBuffers = new Set();

        const destroyBufferOnce = buffer => {
            if (!buffer || destroyedBuffers.has(buffer)) {
                return;
            }

            destroyedBuffers.add(buffer);
            buffer.destroy?.();
        };

        this.meshes.forEach(mesh => {
            destroyBufferOnce(mesh.buffer);
        });

        this.overlayMeshes.forEach(overlay => {
            destroyBufferOnce(overlay.faceBuffer);
            destroyBufferOnce(overlay.lineBuffer);
            destroyBufferOnce(overlay.pointBuffer);
        });

        this.particleBuffers.forEach(particles => {
            destroyBufferOnce(particles.buffer);
        });

        this.editorBuffers.forEach(entry => {
            destroyBufferOnce(entry.buffer);
        });

        this.editorInstancedBuffers.forEach(entry => {
            destroyBufferOnce(entry.buffer);
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

        if (this.editorInstancedProgram) {
            gl.deleteProgram(this.editorInstancedProgram);
        }

        if (this.particleProgram) {
            gl.deleteProgram(this.particleProgram);
        }

        this.meshes.clear();
        this.overlayMeshes.clear();
        this.particleBuffers.clear();
        this.editorBuffers.clear();
        this.editorInstancedBuffers.clear();

        this.program = null;
        this.overlayProgram = null;
        this.editorInstancedProgram = null;
        this.particleProgram = null;
        this.ready = false;
    }
}
