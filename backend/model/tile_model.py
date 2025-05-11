import os
import uuid
from PIL import Image
from generated.paths import (PUBLIC_TEMP_UPLOAD_FOLDER)

class TileModel:
    def __init__(self, diffuse_image_url, tile_x=1, tile_y=1):
        self.diffuse_image_url = diffuse_image_url
        self.tile_x = tile_x
        self.tile_y = tile_y
        self.layer_folder = PUBLIC_TEMP_UPLOAD_FOLDER

    def _validate_path(self):
        path = os.path.join(self.layer_folder, os.path.basename(self.diffuse_image_url))
        if not os.path.exists(path):
            raise FileNotFoundError(f"File not found: {path}")
        return path

    def _apply_tile(self, image):
        width, height = image.size
        new_image = Image.new("RGBA", (width * self.tile_x, height * self.tile_y))
        for i in range(self.tile_x):
            for j in range(self.tile_y):
                new_image.paste(image, (i * width, j * height))
        return new_image

    def generate(self):
        path = self._validate_path()
        image = Image.open(path)
        tiled = self._apply_tile(image)

        id = str(uuid.uuid4())

        filename = f"{id}.png"
        save_path = os.path.join(self.layer_folder, filename)
        tiled.save(save_path, format="PNG")

        return {"url": f"/download/{filename}", "id": id, "width": tiled.width, "height": tiled.height}, 200