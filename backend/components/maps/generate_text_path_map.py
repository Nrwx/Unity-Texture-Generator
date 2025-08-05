import os
from fontTools.ttLib import TTFont
from generated.paths import PUBLIC_FONT_FOLDER
from config.data.constant import FONTS
from fontTools.pens.basePen import BasePen


class PathPen(BasePen):
    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.subpaths = []
        self.current = []

    def _moveTo(self, p0):
        if self.current:
            self.subpaths.append(self.current)
        self.current = [("move", p0)]

    def _lineTo(self, p1):
        self.current.append(("line", p1))

    def _curveToOne(self, p1, p2, p3):
        self.current.append(("curve", (p1, p2, p3)))

    def _closePath(self):
        if self.current:
            self.subpaths.append(self.current)
            self.current = []


def generate_glyph_path_data(char, glyph_set, cmap, hmtx, glyf, ascent, scale,
                              x_cursor, letter_spacing, kerning, last_code):
    all_points = []
    all_connections = []
    point_index = 0

    code = ord(char)
    glyph_name = cmap.get(code)
    if not glyph_name:
        return None, x_cursor, last_code

    glyph = glyph_set.get(glyph_name)
    if not glyph:
        return None, x_cursor, last_code

    glyf_glyph = glyf[glyph_name]
    if not glyf_glyph.isComposite and glyf_glyph.numberOfContours == 0:
        advance_width, _ = hmtx.get(glyph_name, (0, 0))
        kern_offset = kerning.get((last_code, code), 0) if last_code else 0
        last_code = code
        x_cursor += (advance_width + kern_offset + letter_spacing)
        return None, x_cursor, last_code

    advance_width, lsb = hmtx[glyph_name]
    kern_offset = kerning.get((last_code, code), 0) if last_code else 0
    last_code = code

    pen = PathPen(glyph_set)
    glyph.draw(pen)

    for subpath in pen.subpaths:
        start_idx = point_index
        for cmd, val in subpath:
            if cmd == "move":
                all_points.append({
                    "x": (val[0] + x_cursor + kern_offset + lsb) * scale,
                    "y": (ascent - val[1]) * scale,
                    "linear": True
                })
            elif cmd == "line":
                all_points.append({
                    "x": (val[0] + x_cursor + kern_offset + lsb) * scale,
                    "y": (ascent - val[1]) * scale,
                    "linear": True
                })
                all_connections.append([point_index - 1, point_index])
            elif cmd == "curve":
                p1, p2, p3 = val
                all_points.append({
                    "x": (p3[0] + x_cursor + kern_offset + lsb) * scale,
                    "y": (ascent - p3[1]) * scale,
                    "linear": False,
                    "bezier": {
                        "cp1": {
                            "x": (p1[0] + x_cursor + kern_offset + lsb) * scale,
                            "y": (ascent - p1[1]) * scale
                        },
                        "cp2": {
                            "x": (p2[0] + x_cursor + kern_offset + lsb) * scale,
                            "y": (ascent - p2[1]) * scale
                        }
                    }
                })
                all_connections.append([point_index - 1, point_index])
            point_index += 1

        if point_index - start_idx > 1:
            all_connections.append([point_index - 1, start_idx])

    x_cursor += advance_width + kern_offset + letter_spacing
    return {
        "points": all_points,
        "connections": all_connections,
        "point_index": point_index
    }, x_cursor, last_code


def generate_text_path_map(layer: dict):
    text = layer.get("text", "")
    font_id = layer.get("font")
    font_size = int(layer.get("fontSize", 20))
    color = layer.get("color", "#000000")
    letter_spacing = float(layer.get("letterSpacing", 0.0))

    # Font-Dateipfad ermitteln
    font_path = None
    for group in FONTS:
        for child in group.get("children", []):
            if child.get("id") == font_id:
                font_path = os.path.join(PUBLIC_FONT_FOLDER, group["id"], os.path.basename(child["path"]))
                break
        if font_path:
            break

    if not font_path or not os.path.exists(font_path):
        raise FileNotFoundError("Font not found")

    # Font laden
    font = TTFont(font_path)
    glyph_set = font.getGlyphSet()
    cmap = font['cmap'].getcmap(3, 1).cmap
    hmtx = font['hmtx']
    ascent = font['hhea'].ascent
    units_per_em = font['head'].unitsPerEm
    scale = font_size / units_per_em

    kerning = {}
    if 'kern' in font:
        for subtable in font['kern'].kernTables:
            if subtable.version == 0:
                kerning.update(subtable.kernTable)

    x_cursor = 0
    last_code = None
    all_points = []
    all_connections = []
    point_index = 0

    for char in text:
        result, x_cursor, last_code = generate_glyph_path_data(
            char=char,
            glyph_set=glyph_set,
            cmap=cmap,
            hmtx=hmtx,
            glyf=font['glyf'],
            ascent=ascent,
            scale=scale,
            x_cursor=x_cursor,
            letter_spacing=letter_spacing * units_per_em,
            kerning=kerning,
            last_code=last_code
        )

        if result:
            offset = point_index
            all_points.extend(result["points"])
            for a, b in result["connections"]:
                all_connections.append([a + offset, b + offset])
            point_index += result["point_index"]

    return {
        "points": all_points,
        "connections": all_connections,
        "fill": color
    }
