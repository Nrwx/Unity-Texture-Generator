VIEWPORT_CONFIG = []

LAYERS = []
GROUPS = []
PATHS = []
BACKUP = []
MAX_BACKUPS = 5

CHANNELS = []
FONTS = []
BRUSHES = []

CURSOR = {}

EXTENSION = [".png", ".jpg", ".jpeg"]
REDIRECT_ROUTE = False

QUEUE_HANDLER = ["/upload", "/brush", "/ai/generateImage", "/modifier"]
FRONTEND_PATH = ['../frontend/dist', 'index.html']

def set_nvcompress(path):
    global NV_COMPRESS
    NV_COMPRESS = path