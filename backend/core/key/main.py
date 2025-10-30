# core/key/main.py
import os
import sys
import logging
from typing import Optional, Tuple
from pathlib import Path
import platform

try:
    import keyring
    _HAS_KEYRING_INSTALLED = True
except Exception:
    _HAS_KEYRING_INSTALLED = False

LOGGER = logging.getLogger("core.key")


class Key:
    """
    Key helper:
      - Key.get_default_paths(app_name) -> (storage_path, key_path)
      - Key.load(service, account, key_path=None, create=True, use_keyring=False)
      - Key.get(...) (only if exists)
      - Key.set(...)
      - Key.delete(...)

    Important: use_keyring default is False. keyring will be used only if use_keyring=True
    and the keyring package is installed.
    """

    @staticmethod
    def get_default_paths(app_name: str) -> Tuple[str, str]:
        """
        Returns (storage_path, key_path) using OS-appropriate user directories.
        """
        app = app_name or "app"
        system = platform.system().lower()
        home = Path.home()

        if system.startswith("win"):
            local = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA") or (home / "AppData" / "Local")
            base = Path(local) / app
        elif system == "darwin":
            base = home / "Library" / "Application Support" / app
        else:
            xdg = os.getenv("XDG_DATA_HOME") or (home / ".local" / "share")
            base = Path(xdg) / app

        base.mkdir(parents=True, exist_ok=True)
        storage = str(base / "secure_store.json")
        keypath = str(base / ".secure_key")
        return storage, keypath

    @staticmethod
    def _ensure_dir_for(path: str):
        d = os.path.dirname(path)
        if d and not os.path.exists(d):
            os.makedirs(d, exist_ok=True)

    @staticmethod
    def _write_bytes_atomic(path: str, data: bytes):
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(data)
        try:
            os.replace(tmp, path)
        except Exception:
            os.rename(tmp, path)
        try:
            if not sys.platform.startswith("win"):
                os.chmod(path, 0o600)
        except Exception:
            pass

    @staticmethod
    def load(service: str, account: str, key_path: Optional[str] = None, create: bool = True, use_keyring: bool = False) -> Optional[bytes]:
        """
        Load key (bytes). If create=True and no key exists, create a new one and persist it.
        use_keyring controls whether we attempt to use OS keyring (only when True).
        """
        # Try keyring if requested and available
        if use_keyring and _HAS_KEYRING_INSTALLED:
            try:
                val = keyring.get_password(service, account)
                if val:
                    LOGGER.debug("Key.load: loaded from keyring")
                    return val.encode("utf-8")
            except Exception as e:
                LOGGER.warning("Key.load: keyring read failed, fallback: %s", e)

        # try local file
        if key_path and os.path.exists(key_path):
            try:
                with open(key_path, "rb") as f:
                    key = f.read()
                    LOGGER.debug("Key.load: loaded from file %s", key_path)
                    return key
            except Exception as e:
                LOGGER.warning("Key.load: read file failed: %s", e)

        if not create:
            return None

        # create new fernet key
        from cryptography.fernet import Fernet
        key = Fernet.generate_key()

        # persist: keyring if requested
        if use_keyring and _HAS_KEYRING_INSTALLED:
            try:
                keyring.set_password(service, account, key.decode("utf-8"))
                LOGGER.info("Key.load: new key persisted to keyring")
                return key
            except Exception as e:
                LOGGER.warning("Key.load: keyring write failed, fallback to file: %s", e)

        # fallback to file
        if key_path:
            try:
                Key._ensure_dir_for(key_path)
                Key._write_bytes_atomic(key_path, key)
                LOGGER.info("Key.load: new key persisted to file %s", key_path)
                return key
            except Exception as e:
                LOGGER.error("Key.load: write file failed: %s", e)

        raise RuntimeError("Key.load: cannot persist generated key (no keyring and no key_path)")

    @staticmethod
    def get(service: str, account: str, key_path: Optional[str] = None, use_keyring: bool = False) -> Optional[bytes]:
        """Load key only if present (do not create)."""
        return Key.load(service, account, key_path=key_path, create=False, use_keyring=use_keyring)

    @staticmethod
    def set(service: str, account: str, key_bytes: bytes, key_path: Optional[str] = None, use_keyring: bool = False) -> None:
        """Persist provided key bytes (try keyring if requested, else file)."""
        if not isinstance(key_bytes, (bytes, bytearray)):
            raise TypeError("Key.set expects bytes")

        if use_keyring and _HAS_KEYRING_INSTALLED:
            try:
                keyring.set_password(service, account, key_bytes.decode("utf-8"))
                LOGGER.info("Key.set: key written to keyring")
                return
            except Exception as e:
                LOGGER.warning("Key.set: keyring write failed, fallback to file: %s", e)

        if key_path:
            Key._ensure_dir_for(key_path)
            Key._write_bytes_atomic(key_path, bytes(key_bytes))
            LOGGER.info("Key.set: key written to file %s", key_path)
            return

        raise RuntimeError("Key.set: cannot persist key (no keyring and no key_path)")

    @staticmethod
    def delete(service: str, account: str, key_path: Optional[str] = None) -> None:
        """Remove from keyring if possible and remove file if present."""
        if _HAS_KEYRING_INSTALLED:
            try:
                keyring.delete_password(service, account)
            except Exception:
                pass
        if key_path and os.path.exists(key_path):
            try:
                os.remove(key_path)
            except Exception:
                pass

    # backwards-compatible aliases
    load_or_create_key = load
    get_key = get
    set_key = set
    delete_key = delete
