# model/cursor_vector.py
import math
from PIL import Image


def normalize_number(value, fallback, min_value=-math.inf, max_value=math.inf):
    try:
        n = float(value)

        if not math.isfinite(n):
            return fallback

        return min(max_value, max(min_value, n))
    except Exception:
        return fallback


# ---------------------------------------------------------------------
# Simple cursor shapes
# ---------------------------------------------------------------------

def simple_circle_path(size, padding=1.5):
    s = max(1, float(size))
    p = min(padding, s / 4)

    cx = s / 2
    cy = s / 2
    r = max(0.5, (s / 2) - p)

    # Cubic Bézier approximation für Kreis.
    k = 0.5522847498

    return (
        f"M {cx:.2f} {cy - r:.2f} "
        f"C {cx + r * k:.2f} {cy - r:.2f} {cx + r:.2f} {cy - r * k:.2f} {cx + r:.2f} {cy:.2f} "
        f"C {cx + r:.2f} {cy + r * k:.2f} {cx + r * k:.2f} {cy + r:.2f} {cx:.2f} {cy + r:.2f} "
        f"C {cx - r * k:.2f} {cy + r:.2f} {cx - r:.2f} {cy + r * k:.2f} {cx - r:.2f} {cy:.2f} "
        f"C {cx - r:.2f} {cy - r * k:.2f} {cx - r * k:.2f} {cy - r:.2f} {cx:.2f} {cy - r:.2f} "
        "Z"
    )


def simple_square_path(size, padding=1.5, radius=1.0):
    s = max(1, float(size))
    p = min(padding, s / 4)

    x1 = p
    y1 = p
    x2 = s - p
    y2 = s - p

    r = min(
        radius,
        max(0, (x2 - x1) / 4),
        max(0, (y2 - y1) / 4),
    )

    if r <= 0:
        return (
            f"M {x1:.2f} {y1:.2f} "
            f"L {x2:.2f} {y1:.2f} "
            f"L {x2:.2f} {y2:.2f} "
            f"L {x1:.2f} {y2:.2f} "
            "Z"
        )

    return (
        f"M {x1 + r:.2f} {y1:.2f} "
        f"L {x2 - r:.2f} {y1:.2f} "
        f"Q {x2:.2f} {y1:.2f} {x2:.2f} {y1 + r:.2f} "
        f"L {x2:.2f} {y2 - r:.2f} "
        f"Q {x2:.2f} {y2:.2f} {x2 - r:.2f} {y2:.2f} "
        f"L {x1 + r:.2f} {y2:.2f} "
        f"Q {x1:.2f} {y2:.2f} {x1:.2f} {y2 - r:.2f} "
        f"L {x1:.2f} {y1 + r:.2f} "
        f"Q {x1:.2f} {y1:.2f} {x1 + r:.2f} {y1:.2f} "
        "Z"
    )


def simple_diamond_path(size, padding=1.5):
    s = max(1, float(size))
    p = min(padding, s / 4)

    cx = s / 2
    cy = s / 2

    return (
        f"M {cx:.2f} {p:.2f} "
        f"L {s - p:.2f} {cy:.2f} "
        f"L {cx:.2f} {s - p:.2f} "
        f"L {p:.2f} {cy:.2f} "
        "Z"
    )


def create_simple_cursor_vector(key="", size=64, shape="circle"):
    view_box_size = max(1, int(round(size)))

    if shape == "square":
        path = simple_square_path(view_box_size)
    elif shape == "diamond":
        path = simple_diamond_path(view_box_size)
    else:
        path = simple_circle_path(view_box_size)
        shape = "circle"

    return {
        "key": key or f"simple-{shape}-{view_box_size}",
        "viewBoxSize": view_box_size,
        "paths": [path],
        "simple": True,
        "shape": shape,
    }


# ---------------------------------------------------------------------
# Mask helpers
# ---------------------------------------------------------------------

def clean_binary_mask(mask, width, height):
    out = mask[:]

    def count_neighbors(x, y):
        count = 0

        for yy in range(-1, 2):
            for xx in range(-1, 2):
                if xx == 0 and yy == 0:
                    continue

                nx = x + xx
                ny = y + yy

                if nx < 0 or ny < 0 or nx >= width or ny >= height:
                    continue

                count += mask[ny * width + nx]

        return count

    for y in range(1, height - 1):
        for x in range(1, width - 1):
            i = y * width + x
            n = count_neighbors(x, y)

            # Einzelne Noise-Pixel entfernen.
            if mask[i] and n <= 1:
                out[i] = 0

            # Kleine Löcher schließen.
            if not mask[i] and n >= 7:
                out[i] = 1

    return out


def marching_squares(mask, width, height):
    segments = []

    def solid(x, y):
        if x < 0 or y < 0 or x >= width or y >= height:
            return 0

        return 1 if mask[y * width + x] else 0

    def add(x1, y1, x2, y2):
        segments.append([
            {"x": x1, "y": y1},
            {"x": x2, "y": y2},
        ])

    for y in range(height - 1):
        for x in range(width - 1):
            tl = solid(x, y)
            tr = solid(x + 1, y)
            br = solid(x + 1, y + 1)
            bl = solid(x, y + 1)

            state = (tl << 3) | (tr << 2) | (br << 1) | bl

            top = {"x": x + 0.5, "y": y}
            right = {"x": x + 1, "y": y + 0.5}
            bottom = {"x": x + 0.5, "y": y + 1}
            left = {"x": x, "y": y + 0.5}

            if state in (0, 15):
                continue
            elif state == 1:
                add(left["x"], left["y"], bottom["x"], bottom["y"])
            elif state == 2:
                add(bottom["x"], bottom["y"], right["x"], right["y"])
            elif state == 3:
                add(left["x"], left["y"], right["x"], right["y"])
            elif state == 4:
                add(top["x"], top["y"], right["x"], right["y"])
            elif state == 5:
                add(top["x"], top["y"], left["x"], left["y"])
                add(bottom["x"], bottom["y"], right["x"], right["y"])
            elif state == 6:
                add(top["x"], top["y"], bottom["x"], bottom["y"])
            elif state == 7:
                add(top["x"], top["y"], left["x"], left["y"])
            elif state == 8:
                add(left["x"], left["y"], top["x"], top["y"])
            elif state == 9:
                add(top["x"], top["y"], bottom["x"], bottom["y"])
            elif state == 10:
                add(left["x"], left["y"], bottom["x"], bottom["y"])
                add(top["x"], top["y"], right["x"], right["y"])
            elif state == 11:
                add(top["x"], top["y"], right["x"], right["y"])
            elif state == 12:
                add(right["x"], right["y"], left["x"], left["y"])
            elif state == 13:
                add(right["x"], right["y"], bottom["x"], bottom["y"])
            elif state == 14:
                add(bottom["x"], bottom["y"], left["x"], left["y"])

    return segments


def connect_segments_to_polylines(segments, epsilon=0.001):
    unused = [
        [
            {"x": seg[0]["x"], "y": seg[0]["y"]},
            {"x": seg[1]["x"], "y": seg[1]["y"]},
        ]
        for seg in segments
    ]

    polylines = []

    def same_point(a, b):
        return (
            abs(a["x"] - b["x"]) <= epsilon
            and abs(a["y"] - b["y"]) <= epsilon
        )

    while unused:
        current = unused.pop()
        line = [current[0], current[1]]

        changed = True

        while changed:
            changed = False

            for i in range(len(unused) - 1, -1, -1):
                a, b = unused[i]
                first = line[0]
                last = line[-1]

                if same_point(last, a):
                    line.append(b)
                elif same_point(last, b):
                    line.append(a)
                elif same_point(first, b):
                    line.insert(0, a)
                elif same_point(first, a):
                    line.insert(0, b)
                else:
                    continue

                unused.pop(i)
                changed = True
                break

        polylines.append(line)

    return polylines


def polyline_length(points):
    length = 0

    for i in range(1, len(points)):
        length += math.hypot(
            points[i]["x"] - points[i - 1]["x"],
            points[i]["y"] - points[i - 1]["y"],
        )

    return length


def perpendicular_distance(p, a, b):
    dx = b["x"] - a["x"]
    dy = b["y"] - a["y"]

    if dx == 0 and dy == 0:
        return math.hypot(p["x"] - a["x"], p["y"] - a["y"])

    t = max(
        0,
        min(
            1,
            ((p["x"] - a["x"]) * dx + (p["y"] - a["y"]) * dy) / (dx * dx + dy * dy),
        ),
    )

    px = a["x"] + t * dx
    py = a["y"] + t * dy

    return math.hypot(p["x"] - px, p["y"] - py)


def simplify_polyline(points, tolerance=0.65):
    if len(points) <= 2:
        return points

    max_distance = 0
    index = 0

    first = points[0]
    last = points[-1]

    for i in range(1, len(points) - 1):
        distance = perpendicular_distance(points[i], first, last)

        if distance > max_distance:
            index = i
            max_distance = distance

    if max_distance > tolerance:
        left = simplify_polyline(points[: index + 1], tolerance)
        right = simplify_polyline(points[index:], tolerance)

        return left[:-1] + right

    return [first, last]


def points_to_path(points):
    if not points:
        return ""

    parts = [
        f'M {points[0]["x"]:.2f} {points[0]["y"]:.2f}'
    ]

    for point in points[1:]:
        parts.append(
            f'L {point["x"]:.2f} {point["y"]:.2f}'
        )

    first = points[0]
    last = points[-1]

    is_closed = (
        abs(first["x"] - last["x"]) < 1.01
        and abs(first["y"] - last["y"]) < 1.01
    )

    if is_closed:
        parts.append("Z")

    return " ".join(parts)


# ---------------------------------------------------------------------
# Simple shape detection
# ---------------------------------------------------------------------

def get_mask_bounds(mask, width, height):
    xs = []
    ys = []

    for y in range(height):
        for x in range(width):
            if mask[y * width + x]:
                xs.append(x)
                ys.append(y)

    if not xs or not ys:
        return None

    return {
        "left": min(xs),
        "top": min(ys),
        "right": max(xs),
        "bottom": max(ys),
        "width": max(xs) - min(xs) + 1,
        "height": max(ys) - min(ys) + 1,
        "area": len(xs),
    }


def detect_simple_shape(mask, width, height):
    bounds = get_mask_bounds(mask, width, height)

    if not bounds:
        return "circle"

    bw = bounds["width"]
    bh = bounds["height"]

    if bw <= 0 or bh <= 0:
        return "circle"

    aspect = bw / bh
    fill_ratio = bounds["area"] / max(1, bw * bh)

    # Sehr volle, quadratische Masken eher als Square.
    # Klassische Brush-Spitzen bleiben meistens Circle.
    if 0.82 <= aspect <= 1.22 and fill_ratio >= 0.82:
        return "square"

    # Mittlere Füllung in quadratischer Box kann Diamond sein.
    if 0.82 <= aspect <= 1.22 and 0.42 <= fill_ratio <= 0.68:
        return "diamond"

    return "circle"


def should_use_simple_cursor(size, simple_size_threshold=16):
    view_box_size = max(1, int(round(size)))
    return view_box_size <= simple_size_threshold


# ---------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------

def generate_cursor(
    image_path,
    key="",
    size=64,
    alpha_threshold=28,
    simplify_tolerance=0.65,
    min_path_length=6,
    max_paths=12,
    simple_size_threshold=16,
    simple_shape="auto",
    fragmented_path_limit=3,
):
    view_box_size = max(1, int(round(size)))

    img = Image.open(image_path).convert("RGBA")
    img = img.resize((view_box_size, view_box_size), Image.Resampling.LANCZOS)

    pixels = img.load()
    raw_strength = [0.0] * (view_box_size * view_box_size)

    for y in range(view_box_size):
        for x in range(view_box_size):
            r, g, b, a = pixels[x, y]

            # Brush-Masks können über RGB statt Alpha codiert sein.
            luminance = max(r, g, b)
            alpha = a / 255.0

            raw_strength[y * view_box_size + x] = luminance * alpha

    border_sum = 0
    border_count = 0

    for x in range(view_box_size):
        border_sum += raw_strength[x]
        border_sum += raw_strength[(view_box_size - 1) * view_box_size + x]
        border_count += 2

    for y in range(view_box_size):
        border_sum += raw_strength[y * view_box_size]
        border_sum += raw_strength[y * view_box_size + view_box_size - 1]
        border_count += 2

    border_average = border_sum / max(1, border_count)

    # Wenn der Rand hell ist, ist die Maske wahrscheinlich invertiert.
    should_invert = border_average >= alpha_threshold

    mask = [0] * (view_box_size * view_box_size)

    for y in range(view_box_size):
        for x in range(view_box_size):
            index = y * view_box_size + x

            strength = (
                255 - raw_strength[index]
                if should_invert
                else raw_strength[index]
            )

            # Außenkante leer halten, damit nie die ViewBox selbst getraced wird.
            is_outer_pixel = (
                x <= 0
                or y <= 0
                or x >= view_box_size - 1
                or y >= view_box_size - 1
            )

            mask[index] = (
                0
                if is_outer_pixel
                else (1 if strength >= alpha_threshold else 0)
            )

    clean_mask = clean_binary_mask(mask, view_box_size, view_box_size)

    detected_shape = (
        detect_simple_shape(clean_mask, view_box_size, view_box_size)
        if simple_shape == "auto"
        else simple_shape
    )

    # Kleine Brushes bewusst simpel halten.
    # Dadurch entstehen stabile, gut sichtbare Cursor statt kaputter Mini-Masken.
    if should_use_simple_cursor(view_box_size, simple_size_threshold):
        return create_simple_cursor_vector(
            key=key,
            size=view_box_size,
            shape=detected_shape,
        )

    segments = marching_squares(clean_mask, view_box_size, view_box_size)
    polylines = connect_segments_to_polylines(segments)

    simplified = [
        simplify_polyline(points, simplify_tolerance)
        for points in polylines
    ]

    filtered = [
        points
        for points in simplified
        if polyline_length(points) >= min_path_length
    ]

    filtered.sort(key=polyline_length, reverse=True)

    paths = [
        points_to_path(points)
        for points in filtered[:max_paths]
    ]

    # Fallback: kein brauchbarer Pfad.
    if not paths:
        return create_simple_cursor_vector(
            key=key,
            size=view_box_size,
            shape=detected_shape,
        )

    # Fallback: kleine/mittlere Brushes mit zu vielen Fragmenten.
    # Das passiert oft bei komplexen Masks, Noise oder schlecht erkannten Kreisen.
    if view_box_size <= 24 and len(paths) > fragmented_path_limit:
        return create_simple_cursor_vector(
            key=key,
            size=view_box_size,
            shape=detected_shape,
        )

    return {
        "key": key or f"{view_box_size}-{len('|'.join(paths))}",
        "viewBoxSize": view_box_size,
        "paths": paths,
        "simple": False,
        "shape": detected_shape,
    }