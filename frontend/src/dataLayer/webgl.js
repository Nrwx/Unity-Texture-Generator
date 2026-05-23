import {Volume} from "@/view/models/page/material/core/Volume/Volume";
import {Fluid} from "@/view/models/page/material/core/Fluid/Fluid";
import {Node} from "@/view/models/page/material/core/Node/Node";
import {ParticleSystem} from "@/view/models/page/material/core/ParticleSystem/ParticleSystem";
import {UV} from "@/view/models/page/material/core/UV/UV";
import {Mesh} from "@/view/models/page/material/core/Mesh/Mesh";

export const SURFACE_ALIASES = Object.freeze({
    baseColor: ["baseColor", "base_color"],
    subsurfaceRadius: ["subsurfaceRadius", "subsurface_radius"],
    subsurfaceColor: ["subsurfaceColor", "subsurface_color"],
    subsurfaceScale: ["subsurfaceScale", "subsurface_scale"],
    subsurfaceIor: ["subsurfaceIor", "subsurface_ior"],
    subsurfaceAnisotropy: ["subsurfaceAnisotropy", "subsurface_anisotropy"],
    specularTint: ["specularTint", "specular_tint"],
    diffuseRoughness: ["diffuseRoughness", "diffuse_roughness"],
    anisotropicRotation: ["anisotropicRotation", "anisotropic_rotation"],
    sheenRoughness: ["sheenRoughness", "sheen_roughness"],
    sheenTint: ["sheenTint", "sheen_tint"],
    clearcoatRoughness: ["clearcoatRoughness", "clearcoat_roughness"],
    coatIor: ["coatIor", "coat_ior", "clearcoatIor", "clearcoat_ior"],
    coatTint: ["coatTint", "coat_tint", "clearcoatTint", "clearcoat_tint"],
    transmissionRoughness: ["transmissionRoughness", "transmission_roughness"],
    emissionStrength: ["emissionStrength", "emission_strength"],
    thinFilmThickness: ["thinFilmThickness", "thin_film_thickness"],
    thinFilmIor: ["thinFilmIor", "thin_film_ior"],
    clearcoatNormal: ["clearcoatNormal", "clearcoat_normal"],
    bumpStrength: ["bumpStrength", "bump_strength"],
    displacementStrength: ["displacementStrength", "displacement_strength"],
});
export const SURFACE_RANGES = Object.freeze({
    emissionStrength: [0, 10],
    ior: [1, 4],
    subsurfaceScale: [0, 50],
    subsurfaceIor: [1, 2],
    coatIor: [1, 2],
    thinFilmThickness: [0, 1200],
    thinFilmIor: [1, 2],
});
export const SCALAR_TEXTURE_SLOT_KEYS = Object.freeze([
    "subsurface",
    "subsurfaceScale",
    "subsurface_scale",
    "subsurfaceIor",
    "subsurface_ior",
    "subsurfaceAnisotropy",
    "subsurface_anisotropy",
    "metallic",
    "specular",
    "specularTint",
    "specular_tint",
    "roughness",
    "diffuseRoughness",
    "diffuse_roughness",
    "anisotropic",
    "anisotropicRotation",
    "anisotropic_rotation",
    "sheen",
    "sheenRoughness",
    "sheen_roughness",
    "sheenTint",
    "sheen_tint",
    "clearcoat",
    "clearcoatRoughness",
    "clearcoat_roughness",
    "coatIor",
    "coat_ior",
    "ior",
    "transmission",
    "transmissionRoughness",
    "transmission_roughness",
    "emissionStrength",
    "emission_strength",
    "thinFilmThickness",
    "thin_film_thickness",
    "thinFilmIor",
    "thin_film_ior",
    "normal",
    "clearcoatNormal",
    "clearcoat_normal",
    "tangent",
    "bumpStrength",
    "bump_strength",
    "displacementStrength",
    "displacement_strength",
]);
export const SLOT_CANONICAL_KEYS = Object.freeze({
    base_color: "baseColor",
    subsurface_radius: "subsurfaceRadius",
    subsurface_color: "subsurfaceColor",
    subsurface_scale: "subsurfaceScale",
    subsurface_ior: "subsurfaceIor",
    subsurface_anisotropy: "subsurfaceAnisotropy",
    specular_tint: "specularTint",
    diffuse_roughness: "diffuseRoughness",
    anisotropic_rotation: "anisotropicRotation",
    sheen_roughness: "sheenRoughness",
    sheen_tint: "sheenTint",
    clearcoat_roughness: "clearcoatRoughness",
    coat_ior: "coatIor",
    clearcoat_ior: "coatIor",
    coat_tint: "coatTint",
    clearcoat_tint: "coatTint",
    transmission_roughness: "transmissionRoughness",
    emission_color: "emission",
    emission_strength: "emissionStrength",
    thin_film_thickness: "thinFilmThickness",
    thin_film_ior: "thinFilmIor",
    clearcoat_normal: "clearcoatNormal",
    bump_strength: "bumpStrength",
    displacement_strength: "displacementStrength",
});
export const COLOR_TEXTURE_SLOTS = Object.freeze(["baseColor", "base_color", "subsurfaceColor", "subsurface_color", "coatTint", "coat_tint", "clearcoatTint", "clearcoat_tint",]);
export const ALPHA_TEXTURE_SLOTS = Object.freeze(["alpha"]);

export const MATERIAL_TEXTURE_SLOTS = Object.freeze(["baseColor", "base_color", "subsurfaceColor", "subsurface_color"]);
export const CANVAS2D_TEXTURE_SLOTS = Object.freeze(["baseColor", "base_color"]);
export const VISIBLE_TEXTURE_SLOTS = Object.freeze([
    "baseColor",
    "base_color",
    "subsurfaceColor",
    "subsurface_color",
    "coatTint",
    "coat_tint",
    "clearcoatTint",
    "clearcoat_tint",
    "emission",
    "emission_color",
    "alpha",
    ...SCALAR_TEXTURE_SLOT_KEYS,
]);

export const FACE_NORMALS = Object.freeze({front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0],});

export const SURFACE_FIELDS = Object.freeze([
    { key: "baseColor", label: "Base Color", type: "color" },
    { key: "subsurface", label: "Subsurface", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "subsurfaceRadius", label: "Subsurface Radius", type: "vector3" },
    { key: "subsurfaceColor", label: "Subsurface Color", type: "color" },
    { key: "subsurfaceScale", label: "Subsurface Scale", type: "number", min: 0, max: 50, step: 0.01 },
    { key: "subsurfaceIor", label: "Subsurface IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "subsurfaceAnisotropy", label: "Subsurface Anisotropy", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "metallic", label: "Metallic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specular", label: "Specular IOR Level", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "specularTint", label: "Specular Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "roughness", label: "Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "diffuseRoughness", label: "Diffuse Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropic", label: "Anisotropic", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "anisotropicRotation", label: "Anisotropic Rotation", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheen", label: "Sheen", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheenRoughness", label: "Sheen Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "sheenTint", label: "Sheen Tint", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoat", label: "Coat Weight", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatRoughness", label: "Coat Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "coatIor", label: "Coat IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "coatTint", label: "Coat Tint", type: "color" },
    { key: "ior", label: "IOR", type: "number", min: 1, max: 4, step: 0.001 },
    { key: "transmission", label: "Transmission Weight", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "transmissionRoughness", label: "Transmission Roughness", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "emission", label: "Emission", type: "color" },
    { key: "emissionStrength", label: "Emission Strength", type: "number", min: 0, max: 10, step: 0.01 },
    { key: "thinFilmThickness", label: "Thin Film Thickness", type: "number", min: 0, max: 1200, step: 1 },
    { key: "thinFilmIor", label: "Thin Film IOR", type: "number", min: 1, max: 2, step: 0.001 },
    { key: "alpha", label: "Alpha", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "normal", label: "Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "clearcoatNormal", label: "Clearcoat Normal", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "tangent", label: "Tangent", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "bumpStrength", label: "Bump / Height", type: "number", min: 0, max: 1, step: 0.001 },
    { key: "displacementStrength", label: "Displacement Height", type: "number", min: 0, max: 1, step: 0.001, hidden: true },
]);
export const SURFACE_FIELD_MAP = Object.freeze(SURFACE_FIELDS.reduce((acc, field) => {acc[field.key] = field;return acc;}, {}));
export const PRINCIPLED_SURFACE_GROUPS = Object.freeze([
    {
        key: "baseColor",
        label: "Base Color",
        relation: "Diffuse, subsurface, metal and transmission color",
    },
    {
        key: "metallic",
        label: "Metallic",
        relation: "Dielectric to metal reflection blend",
    },
    {
        key: "roughness",
        label: "Roughness",
        relation: "Specular and transmission microfacet roughness",
    },
    {
        key: "ior",
        label: "IOR",
        relation: "Specular and transmission refraction index",
    },
    {
        key: "alpha",
        label: "Alpha",
        relation: "Surface opacity / texture alpha mask",
    },
    {
        key: "normal",
        label: "Normal",
        relation: "Base layer normal response",
    },
    {
        key: "subsurface",
        label: "Subsurface",
        relation: "Weight -> Radius -> Scale -> IOR -> Anisotropy",
        affects: ["subsurfaceRadius", "subsurfaceColor", "subsurfaceScale", "subsurfaceIor", "subsurfaceAnisotropy"],
    },
    {
        key: "specular",
        label: "Specular",
        relation: "IOR Level -> Tint -> Anisotropic -> Anisotropic Rotation -> Tangent",
        affects: ["specularTint", "anisotropic", "anisotropicRotation", "tangent"],
    },
    {
        key: "transmission",
        label: "Transmission",
        relation: "Weight",
        affects: ["transmissionRoughness"],
    },
    {
        key: "clearcoat",
        label: "Coat",
        relation: "Weight -> Roughness -> IOR -> Tint -> Normal",
        affects: ["clearcoatRoughness", "coatIor", "coatTint", "clearcoatNormal"],
    },
    {
        key: "sheen",
        label: "Sheen",
        relation: "Weight -> Roughness -> Tint",
        affects: ["sheenRoughness", "sheenTint"],
    },
    {
        key: "emission",
        label: "Emission",
        relation: "Color -> Strength -> Tint",
        affects: ["emissionStrength"],
    },
].map(group => ({...group, field: SURFACE_FIELD_MAP[group.key]})));
export const TEXTURE_SETTING_DEFAULTS = {...Node.TEXTURE_SETTING_DEFAULTS};
export const TEXTURE_CHANNEL_OPTIONS = Object.freeze(["rgba", "rgb"]);
export const TEXTURE_COLOR_MODE_OPTIONS = Object.freeze(["color", "bw"]);
export const BW_TEXTURE_SLOTS = Object.freeze(["subsurface", "subsurfaceScale", "subsurfaceIor", "subsurfaceAnisotropy", "metallic", "specular", "specularTint", "roughness", "diffuseRoughness", "anisotropic", "anisotropicRotation", "sheen", "sheenRoughness", "sheenTint", "clearcoat", "clearcoatRoughness", "coatIor", "ior", "transmission", "transmissionRoughness", "emissionStrength", "thinFilmThickness", "thinFilmIor", "alpha", "normal", "clearcoatNormal", "tangent", "bumpStrength", "displacementStrength"]);
export const PRIMITIVE_OPTIONS = Object.freeze(["cube", "box", "plane", "sphere", "cylinder"]);
export const UV_FIT_OPTIONS = Object.freeze(["stretch", "contain", "cover", "tile", "world"]);
export const SUBDIVISION_TYPE_OPTIONS = Object.freeze(["simple", "catmull-clark"]);
export const VOLUME_MODE_OPTIONS = Volume.MODES;
export const VOLUME_FALLOFF_OPTIONS = Volume.FALL_OFF;
export const FLUID_TYPE_OPTIONS = Fluid.TYPES;
export const FLUID_SOLVER_OPTIONS = Fluid.SOLVERS;
export const LIGHT_TYPE_OPTIONS = Object.freeze(["sun", "directional", "point", "spot", "area",]);
export const PARTICLE_MODE_OPTIONS = Object.freeze([{ title: "Standard", value: "texture" }, { title: "Mesh", value: "mesh" },]);
export const PARTICLE_SOURCE_OPTIONS = Object.freeze(["texture", "mesh", "volume"]);
export const PARTICLE_EMITTER_OPTIONS = Object.freeze(["volume", "surface", "vertices", "sphere", "plane"]);
export const PARTICLE_ROOT_ANIMATION_OPTIONS = Object.freeze(["point", "inner", "outer"]);
export const PARTICLE_VOLUME_FLOW_OPTIONS = Object.freeze([{ title: "Inside Volume", value: "inside" }, { title: "Outside Surface", value: "outside" }]);
export const PARTICLE_BLEND_OPTIONS = Object.freeze(["alpha", "additive", "screen"]);
export const PARTICLE_INTERPOLATION_ATTRIBUTES = ParticleSystem.INTERPOLATION_ATTRIBUTES;
export const PARTICLE_SEQUENCE_MODE_OPTIONS = Object.freeze([{ title: "Clockwise", value: "clockwise" }, { title: "Random", value: "random" }]);
export const PARTICLE_LAYER_SETTING_KEYS = Object.freeze(["mode", "source", "emitter", "root_animation", "volume_flow", "count", "seed", "lifetime", "time_scale", "size", "radius", "random_size", "size_randomness", "size_x", "size_y", "alpha", "spread_x", "spread_y", "spread_z", "velocity", "velocity_x", "velocity_y", "velocity_z", "direction_x", "direction_y", "direction_z", "rotation", "velocity_randomness", "gravity", "turbulence", "orbit", "mesh_influence", "color", "color_ramp", "blend", "depth_write", "sort", "use_mesh_reference", "interpolation_attribute", "interpolations", "path_follow"]);
export const INTERPOLATION_RANGES = Object.freeze({alpha: { min: 0, max: 1, visualMax: 1, step: 0.01, label: "Alpha 0-1" }, size_x: { min: 0, max: null, visualMin: 0, visualMax: 100, step: 0.01, label: "Size X" }, size_y: { min: 0, max: null, visualMin: 0, visualMax: 100, step: 0.01, label: "Size Y" }, direction_x: { min: null, max: null, visualMin: -100, visualMax: 100, step: 1, label: "Direction X" }, direction_y: { min: null, max: null, visualMin: -100, visualMax: 100, step: 1, label: "Direction Y" }, direction_z: { min: null, max: null, visualMin: -100, visualMax: 100, step: 1, label: "Direction Z" }, rotation: { min: null, max: null, visualMin: -360, visualMax: 360, step: 1, label: "Rotation" }});
export const PATH_GRID_MODES = Object.freeze([{ title: "Normal", value: "normal" }, { title: "Alle", value: "all" },]);
export const PATH_VIEW_DEFINITIONS = Object.freeze({top: { key: "top", label: "Top", horizontal: "x", vertical: "z", hSign: 1, vSign: -1 }, bottom: { key: "bottom", label: "Bottom", horizontal: "x", vertical: "z", hSign: 1, vSign: 1 }, left: { key: "left", label: "Left", horizontal: "z", vertical: "y", hSign: -1, vSign: -1 }, right: { key: "right", label: "Right", horizontal: "z", vertical: "y", hSign: 1, vSign: -1 }, front: { key: "front", label: "Front", horizontal: "x", vertical: "y", hSign: 1, vSign: -1 }, back: { key: "back", label: "Back", horizontal: "x", vertical: "y", hSign: -1, vSign: -1 }});
export const PATH_VIEW_OPTIONS = Object.freeze(Object.values(PATH_VIEW_DEFINITIONS).map(view => ({title: view.label, value: view.key})));
export const COLLISION_SHAPE_OPTIONS = Object.freeze(["box", "sphere", "capsule", "cylinder", "convex", "mesh"]);
export const BODY_TYPE_OPTIONS = Object.freeze(["static", "kinematic", "dynamic"]);
export const PREVIEW_DEBOUNCE_MS = 220;
export const PRINCIPLED_NODE_INPUT_KEYS = PRINCIPLED_SURFACE_GROUPS.map(group => group.key);
/**
 * @typedef {32 | 64 | 128 | 256 | 512 | 1024 | "Original"} TextureSizeOption
 * @type {TextureSizeOption[]}
 */
export const TEXTURE_SIZE_OPTIONS = [32, 64, 128, 256, 512, 1024, "Original"];
export const RENDER_BACKEND_OPTIONS = Object.freeze([{ title: "Canvas2D", value: "CANVAS2D" }, { title: "WEBGL2", value: "WEBGL2" },]);
export const BLEND_MODE_OPTIONS = Object.freeze(["OPAQUE", "BLEND", "HASHED", "CLIP"]);
export const SHADOW_METHOD_OPTIONS = Object.freeze(["NONE", "OPAQUE", "HASHED", "CLIP"]);

export const getTextureSettingDefaults = slotKey => ({...Node.TEXTURE_SETTING_DEFAULTS, color_mode: BW_TEXTURE_SLOTS.includes(slotKey) ? "bw" : "color"});

export const createSurface = () => ({
    baseColor: [1, 1, 1, 1],
    subsurface: 0,
    subsurfaceRadius: [1, 0.2, 0.1],
    subsurfaceColor: [1, 1, 1, 1],
    subsurfaceScale: 1,
    subsurfaceIor: 1.45,
    subsurfaceAnisotropy: 0,
    metallic: 0,
    specular: 0.5,
    specularTint: 0,
    roughness: 0.5,
    diffuseRoughness: 0,
    anisotropic: 0,
    anisotropicRotation: 0,
    sheen: 0,
    sheenRoughness: 0.5,
    sheenTint: 0.5,
    clearcoat: 0,
    clearcoatRoughness: 0.03,
    coatIor: 1.5,
    coatTint: [1, 1, 1, 1],
    ior: 1.45,
    transmission: 0,
    transmissionRoughness: 0,
    emission: [0, 0, 0, 1],
    emissionStrength: 0,
    thinFilmThickness: 0,
    thinFilmIor: 1.33,
    alpha: 1,
    normal: 0,
    clearcoatNormal: 0,
    tangent: 0,
    bumpStrength: 0,
    displacementStrength: 0,
});
/**
 * @returns {Record<string, any>}
 */
export const createBitmapMaps = () => {
    return SURFACE_FIELDS.reduce((acc, field) => {
        acc[field.key] = {
            enabled: false,
            source_type: "none",

            layer_id: "",
            url: "",
            name: "",

            node_id: "",
            uv_node_id: "",

            faces: {},
            mapped_faces: [],
            texture_groups: [],

            filename: "",
            cached: false,

            ...getTextureSettingDefaults(field.key),

            strength: 1,
            offset: 0,
            invert: false,
            blend: "replace",
        };

        return acc;
    }, /** @type {Record<string, any>} */ ({}));
};
export const createGeometry = () => ({
    primitive: "cube",

    width: 1,
    height: 1,
    depth: 1,

    bevel: 0,
    bevel_segments: 1,

    subdivision: 0,
    subdivision_type: "simple",
    shade_smooth: true,

    uv_fit: "stretch",
    uv_density: 1,

    pivot_x: 0,
    pivot_y: 0,
    pivot_z: 0,

    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,

    scale_x: 1,
    scale_y: 1,
    scale_z: 1,

    volume: Volume.create(),
    fluid: Fluid.create(),
});
/**
 * @typedef {Object} MaterialLight
 * @property {boolean} enabled
 * @property {string} lightType
 * @property {string} mode
 * @property {number} intensity
 * @property {number} ambient
 * @property {number} softness
 * @property {string} color
 * @property {string} ambient_color
 * @property {string} environment_color
 * @property {number} range
 * @property {number} radius
 * @property {number} decay
 * @property {number} innerCone
 * @property {number} outerCone
 * @property {boolean} castShadow
 * @property {number} temperature
 * @property {number} position_x
 * @property {number} position_y
 * @property {number} position_z
 * @property {number} direction_x
 * @property {number} direction_y
 * @property {number} direction_z
 */
/**
 * @returns {MaterialLight}
 */
export const createLight = () => ({
    enabled: true,
    lightType: "sun",
    mode: "sun",
    intensity: 1,
    ambient: 0.34,
    softness: 0.32,
    color: "#fff4e6",
    ambient_color: "#b3c7e6",
    environment_color: "#b8d1ff",
    range: 4,
    radius: 0.25,
    decay: 2,
    innerCone: 0.35,
    outerCone: 0.75,
    castShadow: false,
    temperature: 6500,
    position_x: 0,
    position_y: 1.4,
    position_z: 2.8,
    direction_x: -0.35,
    direction_y: -0.65,
    direction_z: 0.72,
});
export const createParticleSystem = () => ParticleSystem.create();
export const createPhysics = () => ({
    enabled: false,

    collision_enabled: false,
    collision_shape: "mesh",
    collision_margin: 0.02,

    rigid_body: false,
    body_type: "static",

    mass: 1,
    friction: 0.5,
    restitution: 0,

    damping_linear: 0.04,
    damping_angular: 0.1,

    gravity_enabled: true,
    gravity_scale: 1,

    sleep_enabled: true,
    can_sleep: true,

    continuous_collision: false,
});
/**
 * @returns {Record<string, any>}
 */
export const createSettings = () => ({
    render_backend: "WEBGL2",
    texture_size: "Original",
    texture_preload: TEXTURE_SIZE_OPTIONS,

    cube_size: 256,
    rotate_preview: true,
    wireframe_preview: false,
    faces_preview: false,
    vertices_preview: false,
    fluid_mesh_preview: true,
    fluid_particle_preview: true,

    blend_mode: "BLEND",
    alpha_clip: 0.5,

    shadow_method: "HASHED",
    backface_culling: false,
    show_backface: true,

    screen_space_refraction: false,
    refraction_depth: 0,
    subsurface_translucency: false,

    use_nodes: true,
});

export const createShaderNode = (nodeKey, position = { x: 280, y: 140 }) => {return Node.create(nodeKey, position);};
export const createUv = () => UV.create();
export const createMesh = geometry => Mesh.create(geometry || createGeometry(), {rootKey: "material", source: "material-editor",});
export const createParticles = (settings = {}, context = {}) => ParticleSystem.create(settings || createParticleSystem(), context)
export const createPrincipledNode = () => Node.createPrincipled({surfaceFieldMap: SURFACE_FIELD_MAP, principledNodeInputKeys: PRINCIPLED_NODE_INPUT_KEYS, principledSurfaceGroups: PRINCIPLED_SURFACE_GROUPS, createSurface});
export const createOutputNode = () => Node.createOutput();
export const createShaderGraph = () => Node.createGraph({createPrincipled: createPrincipledNode});
