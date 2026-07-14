"""Authentication & authorization primitives.

Pure helpers (password hashing, JWT, Google verification, a small in-memory
rate limiter). FastAPI dependencies that need the DB live in server.py.
"""
import os
import time
import logging
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))

SECRET_KEY = os.environ.get("SECRET_KEY", "").strip()
if not SECRET_KEY:
    # Never ship this default in production - set SECRET_KEY in the environment.
    SECRET_KEY = "dev-insecure-change-me"
    logger.warning("SECRET_KEY not set - using an insecure development default.")

VALID_ROLES = {"customer", "clipper", "admin"}


# ---- Password hashing (bcrypt, 72-byte limit handled) ----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---- JWT ----
def create_access_token(subject: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Raises jwt exceptions on invalid/expired tokens."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# ---- Google OAuth (lazy import; only needed when configured) ----
def verify_google_credential(credential: str) -> dict:
    """Return the verified Google identity claims, or raise ValueError."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise RuntimeError("not_configured")
    from google.oauth2 import id_token
    from google.auth.transport import requests as grequests

    info = id_token.verify_oauth2_token(credential, grequests.Request(), client_id)
    if not info.get("email_verified"):
        raise ValueError("email_not_verified")
    return info


# ---- Tiny in-memory rate limiter (per key, sliding window) ----
_hits = defaultdict(deque)


def rate_limit(key: str, max_hits: int, window_seconds: int) -> bool:
    """Return True if allowed, False if the caller has exceeded the limit."""
    now = time.time()
    q = _hits[key]
    while q and q[0] <= now - window_seconds:
        q.popleft()
    if len(q) >= max_hits:
        return False
    q.append(now)
    return True
