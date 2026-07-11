"""Local-disk media storage.

Files are streamed to MEDIA_ROOT (a persistent Docker volume on the VPS).
Playback/download uses short-lived HMAC-signed URLs so <video>/<img> tags work
without attaching auth headers, and links expire. Authorization is enforced
when a signed URL is *minted* (the caller must already be a party to the
contract / own the project); the media endpoint just verifies the signature.
"""
import os
import time
import hmac
import hashlib
from pathlib import Path

import auth  # reuse the JWT SECRET_KEY for signing

MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/data/media")).resolve()
MAX_UPLOAD_BYTES = int(os.environ.get("UPLOAD_MAX_MB", "1024")) * 1024 * 1024
ALLOWED_PREFIXES = ("video/", "image/")


class UploadError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


def ensure_root():
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)


def safe_path(key: str):
    """Resolve a key under MEDIA_ROOT, rejecting path traversal."""
    p = (MEDIA_ROOT / key).resolve()
    if not str(p).startswith(str(MEDIA_ROOT) + os.sep) and p != MEDIA_ROOT:
        return None
    return p


async def save_upload(upload_file, key: str) -> int:
    ct = (upload_file.content_type or "")
    if not ct.startswith(ALLOWED_PREFIXES):
        raise UploadError(415, "Only video or image files are allowed")
    dest = safe_path(key)
    if dest is None:
        raise UploadError(400, "Invalid upload path")
    dest.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    try:
        with open(dest, "wb") as f:
            while True:
                chunk = await upload_file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    f.close()
                    dest.unlink(missing_ok=True)
                    raise UploadError(413, f"File exceeds the {MAX_UPLOAD_BYTES // (1024*1024)}MB limit")
                f.write(chunk)
    except UploadError:
        raise
    except Exception:
        dest.unlink(missing_ok=True)
        raise UploadError(500, "Upload failed")
    return size


def _sig(key: str, exp: int) -> str:
    msg = f"{key}:{exp}".encode()
    return hmac.new(auth.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def sign_media_url(key: str, expires_in: int = 6 * 3600) -> str:
    exp = int(time.time()) + expires_in
    return f"/api/media/{key}?exp={exp}&sig={_sig(key, exp)}"


def verify_media(key: str, exp, sig) -> bool:
    if not exp or not sig:
        return False
    try:
        exp = int(exp)
    except (ValueError, TypeError):
        return False
    if exp < time.time():
        return False
    return hmac.compare_digest(sig, _sig(key, exp))
