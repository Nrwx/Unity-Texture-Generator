import { blobModifier } from "./blob";
import { clayModifier } from "./clay";
import { creaseModifier } from "./crease";
import { drawSharpModifier } from "./drawSharp";
import { extrudeModifier } from "./extrude";
import { flattenModifier } from "./flatten";
import { inflateModifier } from "./inflate";
import { pinchModifier } from "./pinch";
import { raiseModifier } from "./raise";
import { scrapeModifier } from "./scrape";
import { smoothModifier } from "./smooth";
import { textureStampModifier } from "./textureStamp";

export const BRUSH_MODIFIERS = Object.freeze({
    draw: raiseModifier,
    raise: raiseModifier,
    drawSharp: drawSharpModifier,
    clay: clayModifier,
    layer: clayModifier,
    crease: creaseModifier,
    scrape: scrapeModifier,
    blob: blobModifier,
    extrude: extrudeModifier,
    inflate: inflateModifier,
    deflate: inflateModifier,
    flatten: flattenModifier,
    pinch: pinchModifier,
    grab: pinchModifier,
    smooth: smoothModifier,
    stamp: textureStampModifier,
    textureStamp: textureStampModifier,
});

export const resolveBrushModifier = mode => BRUSH_MODIFIERS[mode] || raiseModifier;
