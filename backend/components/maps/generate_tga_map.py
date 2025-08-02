import struct
from PIL import Image

def generate_tga_map(image: Image.Image, export_path: str, rle: bool = False):
    """
    Exportiert ein PIL-Image im TGA-Format, kompatibel mit Game Engines (Unity, Unreal, Blender).

    :param image: PIL.Image – sollte 'RGBA' oder 'RGB' sein
    :param export_path: Pfad zur Exportdatei
    :param rle: Wenn True, wird das Bild RLE-komprimiert
    """
    # Immer in RGBA konvertieren
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    width, height = image.size
    pixel_data = image.tobytes("raw", "BGRA")  # TGA braucht BGRA order

    header = bytearray(18)
    header[2] = 10 if rle else 2  # Image Type: 2=uncompressed, 10=RLE
    header[12] = width & 0xFF
    header[13] = (width >> 8) & 0xFF
    header[14] = height & 0xFF
    header[15] = (height >> 8) & 0xFF
    header[16] = 32  # 32 bits per pixel
    header[17] = 0x20  # Top-left origin

    with open(export_path, "wb") as f:
        f.write(header)
        if rle:
            f.write(_rle_encode(pixel_data))
        else:
            f.write(pixel_data)

def _rle_encode(data):
    """
    Implementiert einfaches RLE für TGA. Funktioniert nur bei RGBA-Frames.
    """
    encoded = bytearray()
    i = 0
    length = len(data)
    bpp = 4  # bytes per pixel

    while i < length:
        j = i + bpp
        run = 1
        while j < length and data[i:i+bpp] == data[j:j+bpp] and run < 128:
            run += 1
            j += bpp
        if run > 1:
            encoded.append(0x80 | (run - 1))
            encoded.extend(data[i:i + bpp])
            i += run * bpp
        else:
            raw_start = i
            run = 1
            while (i + run * bpp < length and
                   (data[i + (run - 1)*bpp:i + run*bpp] != data[i + run*bpp:i + (run+1)*bpp]) and
                   run < 128):
                run += 1
            encoded.append(run - 1)
            encoded.extend(data[i:i + run * bpp])
            i += run * bpp

    return encoded

