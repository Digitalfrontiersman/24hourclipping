"""Media storage: S3 (when configured) with a local-disk fallback.

Design for scale:
- UPLOADS go DIRECT to S3 from the browser via a presigned PUT URL, so large video
  files never stream through our server.
- VIDEO PLAYBACK/DOWNLOAD uses short-lived presigned GET URLs (served straight from
  S3, no server bandwidth).
- IMAGES (thumbnails/avatars) that need long-lived links are served through the
  HMAC-signed `/api/media/{key}` proxy, which streams the object from S3 (small files).

Originals are stored byte-for-byte (no re-encoding) - genuinely lossless.

Env (S3-compatible: AWS S3, R2, B2, Storj, ...):
  S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
  S3_ENDPOINT_URL   optional (set for R2/B2/Storj; omit for AWS S3)
"""
import os
import time
import hmac
import hashlib
from pathlib import Path

import auth  # reuse the JWT SECRET_KEY for signing the image proxy

MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", "/data/media")).resolve()
MAX_UPLOAD_BYTES = int(os.environ.get("UPLOAD_MAX_MB", "2048")) * 1024 * 1024
ALLOWED_PREFIXES = ("video/", "image/")

S3_BUCKET = os.environ.get("S3_BUCKET", "").strip()
S3_REGION = os.environ.get("S3_REGION", "us-east-1").strip()
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "").strip() or None
_S3_KEY = os.environ.get("S3_ACCESS_KEY_ID", "").strip()
_S3_SECRET = os.environ.get("S3_SECRET_ACCESS_KEY", "").strip()

_s3_client = None


class UploadError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message


def is_s3() -> bool:
    return bool(S3_BUCKET and _S3_KEY and _S3_SECRET)


def _s3():
    global _s3_client
    if _s3_client is None:
        import boto3
        from botocore.config import Config
        _s3_client = boto3.client(
            "s3", region_name=S3_REGION, endpoint_url=S3_ENDPOINT_URL,
            aws_access_key_id=_S3_KEY, aws_secret_access_key=_S3_SECRET,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
    return _s3_client


def ensure_root():
    if not is_s3():
        MEDIA_ROOT.mkdir(parents=True, exist_ok=True)


def safe_path(key: str):
    p = (MEDIA_ROOT / key).resolve()
    if not str(p).startswith(str(MEDIA_ROOT) + os.sep) and p != MEDIA_ROOT:
        return None
    return p


def _guess_type(key: str) -> str:
    import mimetypes
    return mimetypes.guess_type(key)[0] or "application/octet-stream"


# ---- Direct-to-S3 upload (browser PUTs straight to the bucket) ----
def presign_put(key: str, content_type: str, expires_in: int = 3600) -> str:
    return _s3().generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": key, "ContentType": content_type or "application/octet-stream"},
        ExpiresIn=expires_in,
    )


def presign_get(key: str, expires_in: int = 3600) -> str:
    # ResponseCacheControl makes the browser cache the fetched object (media is
    # immutable per key), so repeat views serve from cache.
    return _s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key, "ResponseCacheControl": "public, max-age=86400"},
        ExpiresIn=expires_in)


def object_exists(key: str) -> bool:
    if not is_s3():
        p = safe_path(key)
        return bool(p and p.exists())
    try:
        _s3().head_object(Bucket=S3_BUCKET, Key=key)
        return True
    except Exception:
        return False


# ---- Server-side upload (proxy fallback / small files) ----
async def save_upload(upload_file, key: str) -> int:
    ct = (upload_file.content_type or "")
    if not ct.startswith(ALLOWED_PREFIXES):
        raise UploadError(415, "Only video or image files are allowed")
    if is_s3():
        size = 0
        chunks = []
        while True:
            chunk = await upload_file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise UploadError(413, f"File exceeds the {MAX_UPLOAD_BYTES // (1024*1024)}MB limit")
            chunks.append(chunk)
        try:
            _s3().put_object(Bucket=S3_BUCKET, Key=key, Body=b"".join(chunks), ContentType=ct)
        except Exception:
            raise UploadError(502, "Upload to storage failed")
        return size
    # local disk
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


def open_stream(key: str):
    """Return (iterator, content_type) for the `/api/media/{key}` proxy (images)."""
    if is_s3():
        obj = _s3().get_object(Bucket=S3_BUCKET, Key=key)
        return obj["Body"].iter_chunks(1024 * 256), obj.get("ContentType") or _guess_type(key)
    p = safe_path(key)
    if p is None or not p.exists():
        return None, None

    def _iter():
        with open(p, "rb") as f:
            while True:
                b = f.read(1024 * 256)
                if not b:
                    break
                yield b
    return _iter(), _guess_type(key)


# ---- HMAC-signed proxy URL (for long-lived image links) ----
def _sig(key: str, exp: int) -> str:
    msg = f"{key}:{exp}".encode()
    return hmac.new(auth.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def sign_media_url(key: str, expires_in: int = 6 * 3600) -> str:
    exp = int(time.time()) + expires_in
    return f"/api/media/{key}?exp={exp}&sig={_sig(key, exp)}"


def media_url(key: str, expires_in: int = 6 * 3600) -> str:
    """Best URL for a key: direct presigned S3 GET when possible (offloads
    bandwidth), else the HMAC proxy. Capped at 7 days for S3 presign."""
    if is_s3():
        return presign_get(key, min(expires_in, 7 * 24 * 3600 - 60))
    return sign_media_url(key, expires_in)


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
