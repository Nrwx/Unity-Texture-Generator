import os
import uuid
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from io import BytesIO
import svgwrite
from generated.paths import PUBLIC_FONT_FOLDER, PUBLIC_TEMP_RENDER_FOLDER
from config.data.constant import (FONTS, LAYERS)
import cairosvg

class RenderModel:

   @staticmethod
   def text_to_path(id, write_svg=False):
       # Layer aus globaler LAYERS-Liste suchen
       layer = next((l for l in LAYERS if l.get("id") == id), None)
       if not layer:
           raise ValueError(f"Layer mit ID '{id}' nicht gefunden")

       text = layer.get("text", "")
       font_id = layer.get("font")
       font_size = int(layer.get("fontSize", 20))
       color = layer.get("color", "#000000")

       # Font suchen
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

       font = TTFont(font_path)
       glyph_set = font.getGlyphSet()
       cmap = font['cmap'].getcmap(3, 1).cmap
       units_per_em = font['head'].unitsPerEm
       scale = font_size / units_per_em

       all_points = []
       connections = []
       x_cursor = 0
       point_index = 0

       class PathPen(BasePen):
           def __init__(self, glyphSet):
               super().__init__(glyphSet)
               self.path_points = []
               self.path_connections = []

           def _moveTo(self, p0):
               self.path_points.append({"x": p0[0], "y": -p0[1], "linear": True})

           def _lineTo(self, p1):
               self.path_points.append({"x": p1[0], "y": -p1[1], "linear": True})
               self.path_connections.append([len(self.path_points) - 2, len(self.path_points) - 1])

           def _curveToOne(self, p1, p2, p3):
               idx = len(self.path_points)
               self.path_points.append({
                   "x": p3[0], "y": -p3[1],
                   "linear": False,
                   "bezier": {
                       "cp1": {"x": p1[0], "y": -p1[1]},
                       "cp2": {"x": p2[0], "y": -p2[1]},
                   }
               })
               self.path_connections.append([idx - 1, idx])

           def _closePath(self):
               if len(self.path_points) > 1:
                   self.path_connections.append([len(self.path_points) - 1, 0])

       for char in text:
           glyph_name = cmap.get(ord(char))
           if not glyph_name:
               continue
           glyph = glyph_set[glyph_name]
           pen = PathPen(glyph_set)
           glyph.draw(pen)

           for p in pen.path_points:
               p["x"] = (p["x"] + x_cursor) * scale
               p["y"] = p["y"] * scale
               all_points.append(p)

           for conn in pen.path_connections:
               connections.append([
                   point_index + conn[0],
                   point_index + conn[1]
               ])

           point_index += len(pen.path_points)
           x_cursor += glyph.width

       width = max([p["x"] for p in all_points]) - min([p["x"] for p in all_points]) if all_points else 0
       height = max([p["y"] for p in all_points]) - min([p["y"] for p in all_points]) if all_points else 0

       result = {
           "name": "TextForm",
           "closed": False,
           "edit": True,
           "width": width,
           "height": height,
           "points": all_points,
           "connections": connections,
           "stroke": "#000000",
           "strokeWidth": 1,
           "strokeDash": 0,
           "strokeDashArray": [],
           "strokeDashType": '',
           "fill": color,
           "fillOpacity": 1,
           "gradient": {
               "type": "linear",
               "angle": 90,
               "stops": [],
           }
       }

       if write_svg:
           dwg = svgwrite.Drawing(size=(f"{width}px", f"{height}px"))
           for conn in connections:
               p1 = all_points[conn[0]]
               p2 = all_points[conn[1]]
               if p2.get("linear", True):
                   dwg.add(dwg.line(start=(p1["x"], height - p1["y"]), end=(p2["x"], height - p2["y"]), stroke=color))
               else:
                   cp1 = p2["bezier"]["cp1"]
                   cp2 = p2["bezier"]["cp2"]
                   path_data = f"M {p1['x']},{height - p1['y']} C {cp1['x']},{height - cp1['y']} {cp2['x']},{height - cp2['y']} {p2['x']},{height - p2['y']}"
                   dwg.add(dwg.path(d=path_data, fill="none", stroke=color))

           svg_path = os.path.join(PUBLIC_TEMP_RENDER_FOLDER, f"{uuid.uuid4()}.svg")
           dwg.saveas(svg_path)

           try:
               cairosvg.svg2png(url=svg_path, write_to=svg_path.replace(".svg", ".png"))
           except Exception as e:
               print(f"⚠️ CairoSVG Fehler: {e}")

           result["svgPath"] = svg_path

       return result
