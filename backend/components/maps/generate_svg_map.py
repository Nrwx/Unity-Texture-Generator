import math
import uuid
from typing import List, Dict, Optional


def generate_svg_path(points: List[Dict], connections: List[List[int]], closed: bool = False) -> str:
    if not connections or not points:
        return ""

    path_cmds = []

    # Sicherer Startpunkt
    try:
        idx_start = connections[0][0]
        p_start = points[idx_start]
        path_cmds.append(f"M {p_start['x']} {p_start['y']}")
    except (IndexError, KeyError, TypeError):
        return ""

    for idx_a, idx_b in connections:
        try:
            pA = points[idx_a]
            pB = points[idx_b]
        except (IndexError, TypeError):
            continue  # Ungültige Verbindung ignorieren

        linearA = bool(pA.get("linear"))
        linearB = bool(pB.get("linear"))

        bezA = pA.get("bezier") or {}
        bezB = pB.get("bezier") or {}

        cp2 = bezA.get("cp2")
        cp1 = bezB.get("cp1")

        use_bezier = (not linearA and not linearB and cp2 and cp1)

        if use_bezier:
            try:
                path_cmds.append(
                    f"C {cp2['x']} {cp2['y']}, {cp1['x']} {cp1['y']}, {pB['x']} {pB['y']}"
                )
            except (KeyError, TypeError):
                path_cmds.append(f"L {pB['x']} {pB['y']}")
        else:
            path_cmds.append(f"L {pB['x']} {pB['y']}")

    if closed:
        path_cmds.append("Z")

    return " ".join(path_cmds)


def get_svg_box(points: List[Dict]) -> List[int]:
    xs, ys = [], []

    for p in points:
        try:
            xs.append(p["x"])
            ys.append(p["y"])
        except KeyError:
            continue

        bezier = p.get("bezier") or {}

        cp1 = bezier.get("cp1")
        cp2 = bezier.get("cp2")

        if cp1:
            xs.append(cp1.get("x", 0))
            ys.append(cp1.get("y", 0))
        if cp2:
            xs.append(cp2.get("x", 0))
            ys.append(cp2.get("y", 0))

    if not xs or not ys:
        return [0, 0, 1, 1]  # Fallback

    padding = 2
    min_x = min(xs)
    min_y = min(ys)
    max_x = max(xs)
    max_y = max(ys)

    return [
        int(min_x - padding),
        int(min_y - padding),
        int(max(1, (max_x - min_x) + 2 * padding)),
        int(max(1, (max_y - min_y) + 2 * padding)),
    ]


def angle_to_gradient_coords(angle_deg: float):
    angle = (angle_deg + 360) % 360
    angle_rad = math.radians(angle - 90)

    x1 = 50 - math.cos(angle_rad) * 50
    y1 = 50 - math.sin(angle_rad) * 50
    x2 = 50 + math.cos(angle_rad) * 50
    y2 = 50 + math.sin(angle_rad) * 50
    return x1, y1, x2, y2


def build_gradient_def(gradient: Optional[dict], gradient_id: str,
                       x: float = 0, y: float = 0,
                       width: float = 100, height: float = 100) -> str:
    if not isinstance(gradient, dict):
        return ""

    stops_data = gradient.get("stops", [])
    if not isinstance(stops_data, list):
        stops_data = []

    stops = "\n".join(
        f'<stop offset="{stop.get("offset", 0)}%" stop-color="{stop.get("color", "#000")}" '
        f'stop-opacity="{stop.get("opacity", 1)}"/>'
        for stop in stops_data
        if isinstance(stop, dict)
    )

    gtype = gradient.get("type", "linear")

    if gtype == "linear":
        x1, y1, x2, y2 = angle_to_gradient_coords(gradient.get("angle", 0))
        return f'''
        <linearGradient id="{gradient_id}" gradientUnits="userSpaceOnUse"
                        x1="{x + width * x1 / 100}" y1="{y + height * y1 / 100}"
                        x2="{x + width * x2 / 100}" y2="{y + height * y2 / 100}">
            {stops}
        </linearGradient>'''

    elif gtype == "radial":
        cx = x + width / 2
        cy = y + height / 2
        r = max(width, height) / 2
        return f'''
        <radialGradient id="{gradient_id}" gradientUnits="userSpaceOnUse"
                        cx="{cx}" cy="{cy}" r="{r}" fx="{cx}" fy="{cy}">
            {stops}
        </radialGradient>'''

    elif gtype == "path":
        css_stops = ", ".join(
            f"{stop.get('color', '#000')} {stop.get('offset', 0)}%" for stop in stops_data
        )
        css_gradient = f"conic-gradient({css_stops})"
        return f'''
        <pattern id="{gradient_id}" patternUnits="userSpaceOnUse"
                 x="{x}" y="{y}" width="{width}" height="{height}">
            <foreignObject width="{width}" height="{height}">
                <div xmlns="http://www.w3.org/1999/xhtml" style="
                    width: 100%;
                    height: 100%;
                    background: {css_gradient};
                "></div>
            </foreignObject>
        </pattern>'''

    return ""



def generate_svg_map(layer: dict) -> str:
    points = layer.get("points", [])
    connections = layer.get("connections", [])

    if not points or not connections:
        return ""

    d_path = generate_svg_path(points, connections, closed=layer.get("closed", False))
    min_x, min_y, width, height = get_svg_box(points)
    viewbox = f"{min_x} {min_y} {width} {height}"

    gradient_id = f"grad_{uuid.uuid4().hex[:8]}"
    has_gradient = bool(layer.get("gradient", {}).get("stops"))
    fill_value = f"url(#{gradient_id})" if has_gradient else layer.get("fill", "#ffffff")
    defs = defs = build_gradient_def(layer.get("gradient"), gradient_id, min_x, min_y, width, height) if has_gradient else ""

    # Stroke-Dasharray
    stroke_dasharray = ""
    dash_type = layer.get("strokeDashType", "")
    dash_value = layer.get("strokeDash", 0)
    dash_array = layer.get("strokeDashArray", [])

    if dash_array:
        try:
            stroke_dasharray = ", ".join(str(float(v)) for v in dash_array)
        except (ValueError, TypeError):
            stroke_dasharray = ""
    elif dash_value:
        try:
            val = float(dash_value)
            stroke_dasharray = f"{val}, {val}"
        except (ValueError, TypeError):
            stroke_dasharray = ""
    elif dash_type == "dotted":
        stroke_dasharray = "1, 2"
    elif dash_type == "dashed":
        stroke_dasharray = "5, 5"

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="{viewbox}"
     width="{width}"
     height="{height}"
     preserveAspectRatio="xMidYMid meet"
     fill="none">
  <defs>{defs}</defs>
  <g opacity="{layer.get("fillOpacity", 1)}">
    <path d="{d_path}"
          fill="{fill_value}"
          stroke="{layer.get("stroke", '#000000')}"
          stroke-width="{layer.get("strokeWidth", 1.5)}"
          stroke-dasharray="{stroke_dasharray}"/>
  </g>
</svg>'''

    return svg.strip()
