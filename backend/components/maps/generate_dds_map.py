import os
import subprocess
import uuid
from PIL import Image
from config.app.manager.global_manager import GlobalManager
from generated.paths import PUBLIC_TEMP_RENDER_FOLDER

GLOBAL_MANAGER = GlobalManager()
NV_COMPRESS = GLOBAL_MANAGER.get("NVCOMPRESS_PATH")

# Unterstützte nvcompress-Formate (Mapping von Klartext → CLI-Flag)
_NV_COMPRESS_FORMATS = {
    "DXT1": "-bc1",
    "DXT3": "-bc2",
    "DXT5": "-bc3",
    "BC4":  "-bc4",
    "BC5":  "-bc5",
    "BC7":  "-bc7",
    "RGBA8": "-rgb",
    "RGB8":  "-rgb",
    "R8G8B8A8": "-rgb",
    "R5G6B5": "-fastcompress",
    "UNCOMPRESSED": "-rgb",  # fallback
}


def generate_dds_map(image, export_path, generate_mipmaps, compression):
    """
    Erzeugt eine komprimierte DDS-Textur ausschließlich über nvcompress.
    """

    if not NV_COMPRESS or not os.path.isfile(NV_COMPRESS):
        raise RuntimeError("❌ nvcompress wurde nicht gefunden. Bitte sicherstellen, dass NV_COMPRESS korrekt gesetzt ist.")

    # Format-Flag validieren
    compression = compression.upper()
    nvcompress_flag = _NV_COMPRESS_FORMATS.get(compression)
    if not nvcompress_flag:
        raise ValueError(f"❌ Nicht unterstütztes Kompressionsformat: '{compression}'")

    # Nur gültige Modi akzeptieren
    if image.mode not in ["RGB", "RGBA"]:
        image = image.convert("RGBA")

    # Sicherstellen, dass der Output-Ordner existiert
    os.makedirs(PUBLIC_TEMP_RENDER_FOLDER, exist_ok=True)

    # Eindeutiger Dateiname zur Vermeidung von Konflikten
    tmp_id = uuid.uuid4()
    tga_path = os.path.join(PUBLIC_TEMP_RENDER_FOLDER, f"{tmp_id}.tga")

    try:
        image.save(tga_path, format="TGA")

        cmd = [
            NV_COMPRESS,
            nvcompress_flag,
            "-nomips" if not generate_mipmaps else "",
            tga_path,
            export_path
        ]
        cmd = [arg for arg in cmd if arg]

        subprocess.run(cmd, check=True)

        if not os.path.isfile(export_path):
            raise RuntimeError("❌ Die DDS-Datei wurde nicht erzeugt – bitte Pfade und Rechte prüfen.")

        print(f"✅ DDS-Datei erfolgreich generiert: {export_path}")

    finally:
        # Temporäre TGA-Datei löschen
        if os.path.exists(tga_path):
            os.remove(tga_path)
