from datetime import datetime, timezone
import time as base_time
import pytz
import tzlocal

DEFAULT_TZ = pytz.UTC


def get_system_timezone():
    try:
        return tzlocal.get_localzone()
    except Exception:
        return DEFAULT_TZ


def get_timezone(tz):
    if tz is None:
        return get_system_timezone()
    if isinstance(tz, str):
        try:
            return pytz.timezone(tz)
        except Exception:
            return DEFAULT_TZ
    if isinstance(tz, timezone) or hasattr(tz, 'tzname'):
        return tz
    return DEFAULT_TZ


def now(tz=None):
    tz = get_timezone(tz)
    return datetime.now(tz)


def now_iso(tz=None):
    return now(tz).isoformat(timespec="milliseconds")


def now_utc_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def now_unix():
    return int(base_time.time())


def now_unix_ms():
    return int(base_time.time() * 1000)


def parse_iso(iso_str, tz=None):
    try:
        if iso_str.endswith("Z"):
            iso_str = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if tz:
            return dt.astimezone(get_timezone(tz))
        return dt
    except Exception as e:
        raise ValueError(f"Ungültiger ISO-Zeitstempel: {iso_str}") from e


def convert_timezone(dt, to_tz):
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=DEFAULT_TZ)
    return dt.astimezone(get_timezone(to_tz))


def time_diff_seconds(start_iso, end_iso):
    start = parse_iso(start_iso)
    end = parse_iso(end_iso)
    return (end - start).total_seconds()


def format_for_filename(dt=None):
    dt = dt or now()
    return dt.strftime("%Y-%m-%d_%H-%M-%S")


# === Zentrale Wrapper-Funktion ===

def time(action="now", *args, **kwargs):
    """Zentrale Dispatch-Funktion für Zeitfunktionen."""
    actions = {
        "now": now,
        "now_iso": now_iso,
        "now_utc_iso": now_utc_iso,
        "unix": now_unix,
        "unix_ms": now_unix_ms,
        "parse_iso": parse_iso,
        "convert": convert_timezone,
        "diff_seconds": time_diff_seconds,
        "filename": format_for_filename
    }

    if action not in actions:
        raise ValueError(f"Unbekannte time()-Aktion: '{action}'")

    return actions[action](*args, **kwargs)
