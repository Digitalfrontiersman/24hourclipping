from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import asyncio
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from seed import seed_db, bond_for
import auth
import storage
import payments
import ziina
import solana_pay as solpay

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NO_ID = {"_id": 0}

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def client_ip(request) -> str:
    """Real client IP behind nginx (X-Forwarded-For), for per-user rate limiting."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---- Presentation / test mode: when on, payments are simulated (no on-chain money) ----
DEFAULT_TEST_MODE = os.environ.get("PAYMENTS_TEST_MODE", "false").lower() == "true"

async def get_test_mode() -> bool:
    doc = await db.settings.find_one({"_id": "app"})
    if doc and "test_mode" in doc:
        return bool(doc["test_mode"])
    return DEFAULT_TEST_MODE

async def set_test_mode(enabled: bool):
    await db.settings.update_one({"_id": "app"}, {"$set": {"test_mode": bool(enabled)}}, upsert=True)


# ---- Email (SMTP e.g. Gmail app password, or Resend) ----
def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email. Prefers SMTP (works to any recipient with no
    domain — e.g. a Gmail App Password); falls back to Resend. No-op if unset."""
    if not to:
        return False
    sender = os.environ.get("EMAIL_FROM", "24 Hour Clipping <onboarding@resend.dev>")

    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    if smtp_host:
        import smtplib
        from email.mime.text import MIMEText
        from email.utils import parseaddr
        try:
            user = os.environ.get("SMTP_USER", "").strip()
            pw = os.environ.get("SMTP_PASS", "")
            port = int(os.environ.get("SMTP_PORT", "587"))
            msg = MIMEText(html, "html", "utf-8")
            msg["Subject"] = subject
            msg["From"] = sender or user
            msg["To"] = to
            server = smtplib.SMTP(smtp_host, port, timeout=20)
            server.starttls()
            if user:
                server.login(user, pw)
            server.sendmail(parseaddr(sender)[1] or user, [to], msg.as_string())
            server.quit()
            logger.info("Email sent (SMTP) to %s (%s)", to, subject)
            return True
        except Exception as e:
            logger.error("SMTP email error: %s", e)
            return False

    key = os.environ.get("RESEND_API_KEY", "").strip()
    if not key:
        return False
    import requests
    try:
        r = requests.post("https://api.resend.com/emails",
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                          json={"from": sender, "to": [to], "subject": subject, "html": html}, timeout=15)
        if r.status_code >= 300:
            logger.error("Resend email failed %s: %s", r.status_code, r.text[:300])
            return False
        logger.info("Email sent to %s (%s)", to, subject)
        return True
    except Exception as e:
        logger.error("Resend email error: %s", e)
        return False


def _acceptance_email_html(name: str, title: str, amount, deadline_iso: str) -> str:
    base = os.environ.get("PUBLIC_BASE_URL", "https://clip42.duckdns.org").rstrip("/")
    return f"""
    <div style="background:#0A0A0A;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#fff">
      <div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:28px">
        <div style="font-size:12px;letter-spacing:.18em;color:#CCFF00;font-weight:bold;text-transform:uppercase">You're hired</div>
        <h1 style="font-size:24px;margin:10px 0 6px">Hey {name}, your bid was accepted!</h1>
        <p style="color:#a1a1aa;font-size:15px;line-height:1.6">
          A creator just picked you to clip <b style="color:#fff">"{title}"</b>. Your deal is live and the
          24-hour clock has started — head to your dashboard to grab the footage and ship your first cut.
        </p>
        <div style="background:#0A0A0A;border-radius:12px;padding:16px;margin:18px 0">
          <div style="color:#71717a;font-size:12px">Payout on approval</div>
          <div style="color:#CCFF00;font-family:monospace;font-size:22px;font-weight:bold">${amount}</div>
        </div>
        <a href="{base}/clipper" style="display:inline-block;background:#CCFF00;color:#000;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:999px">Open your dashboard →</a>
        <p style="color:#52525b;font-size:12px;margin-top:20px">24 Hour Clipping · deliver before the clock hits zero.</p>
      </div>
    </div>"""


class ProjectCreate(BaseModel):
    title: str
    category: str
    description: str = ""
    budget: float
    source_link: str = ""
    source_key: Optional[str] = None  # uploaded source footage (object key)
    source_length: str = ""
    output_length: str = "30-60s"
    aspect_ratio: str = "9:16"
    captions: str = "Bold captions"
    platform: str = "TikTok"
    moment_mode: str = "known"
    goal: str = ""
    audience: str = ""
    mood: str = ""
    style: str = ""
    cta: str = ""
    thumbnail: Optional[str] = None
    thumbnail_key: Optional[str] = None  # uploaded thumbnail image (object key)
    customer_name: str = "Demo Customer"

class BidCreate(BaseModel):
    clipper_id: Optional[str] = None  # ignored; identity comes from the token
    amount: float
    pitch: str
    eta_hours: int

class MessageCreate(BaseModel):
    sender: Optional[str] = None  # ignored; derived from the token
    text: str

class DeliveryCreate(BaseModel):
    note: str = ""
    url: str = ""
    key: Optional[str] = None  # uploaded cut (object key)

class FundRequest(BaseModel):
    payment_method: str = "usdc"

class SolanaFundRequest(BaseModel):
    signature: str
    currency: str = "usdc"  # "usdc" | "sol"

class PayoutWalletRequest(BaseModel):
    wallet: str

class TipRequest(BaseModel):
    signature: str
    amount: float
    currency: str = "usdc"  # "usdc" | "sol"

class TestModeRequest(BaseModel):
    enabled: bool

class RateRequest(BaseModel):
    rating: int = 5

class BrandProfileUpdate(BaseModel):
    name: str = ""
    description: str = ""
    audience: str = ""
    caption_style: str = ""
    pacing: str = ""
    cta: str = ""
    avoid: str = ""
    fonts: str = ""

class ChatRequest(BaseModel):
    session_id: str
    message: str

class BriefRequest(BaseModel):
    session_id: str


# ============================ AUTH ============================
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(min_length=1, max_length=80)
    role: Optional[str] = None  # optional hint; real roles are chosen in onboarding

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str
    role: Optional[str] = None  # optional hint; real roles are chosen in onboarding

class DemoLoginRequest(BaseModel):
    role: str = "customer"

class SwitchRoleRequest(BaseModel):
    role: str  # the capability to make the active mode ("customer" | "clipper" | "admin")

class OnboardingRequest(BaseModel):
    roles: List[str] = []            # subset of {"customer", "clipper"}
    active_role: Optional[str] = None  # which dashboard to land in (defaults to first role)
    # Creator brand basics (all optional) — seeds a brand profile.
    brand_name: str = ""
    niche: str = ""
    content_type: str = ""
    platforms: str = ""
    audience: str = ""
    # Clipper basics (all optional).
    specialties: List[str] = []
    tools: List[str] = []
    samples: List[str] = []
    payout_wallet: str = ""


DEMO_USERS = {
    "customer": {"id": "demo-customer", "email": "customer@demo.24hrclipping.com", "name": "Aria Chen", "role": "customer", "roles": ["customer"], "onboarded": True, "credits": 150},
    "clipper":  {"id": "clipper-1",     "email": "clipper@demo.24hrclipping.com",  "name": "Maya Torres", "role": "clipper", "roles": ["clipper"], "onboarded": True, "credits": 0},
    "admin":    {"id": "demo-admin",    "email": "admin@demo.24hrclipping.com",    "name": "Demo Admin",  "role": "admin",  "roles": ["customer", "clipper", "admin"], "onboarded": True, "credits": 0},
}

bearer_scheme = HTTPBearer(auto_error=False)


def user_roles(u: dict) -> list:
    """Capabilities the account holds. Back-compat: only when the `roles` key is
    ABSENT (a pre-multi-role doc) do we derive it from the legacy single `role`.
    An explicit empty list means "registered but not yet onboarded" — no
    capabilities — and must NOT fall back."""
    roles = u.get("roles")
    if roles is None:
        return [u["role"]] if u.get("role") else []
    return roles


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u.get("email"), "name": u.get("name"),
            "role": u.get("role"), "roles": user_roles(u), "onboarded": bool(u.get("onboarded", True)),
            "credits": u.get("credits", 0), "avatar": u.get("avatar"),
            "payout_wallet": u.get("payout_wallet")}


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> dict:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = auth.decode_access_token(creds.credentials)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    u = await db.users.find_one({"id": payload.get("sub")}, NO_ID)
    if not u or u.get("disabled"):
        raise HTTPException(401, "User not found")
    return u


async def get_current_user_optional(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if not creds:
        return None
    try:
        payload = auth.decode_access_token(creds.credentials)
        return await db.users.find_one({"id": payload.get("sub")}, NO_ID)
    except Exception:
        return None


def require_role(*roles):
    """Capability-based gate: the account must hold at least one of `roles`
    (admin always passes). Active mode (`role`) no longer gates access — a
    "both" account can hit customer and clipper endpoints regardless of the
    dashboard it's currently viewing."""
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        held = set(user_roles(user))
        if "admin" in held or held & set(roles):
            return user
        raise HTTPException(403, "Insufficient permissions")
    return dep


async def _require_project_owner(project_id: str, user: dict) -> dict:
    p = await db.projects.find_one({"id": project_id}, NO_ID)
    if not p:
        raise HTTPException(404, "Project not found")
    if "admin" not in user_roles(user) and p.get("owner_id") != user["id"]:
        raise HTTPException(403, "You do not own this project")
    return p


async def _require_contract_party(contract_id: str, user: dict, allow=("customer", "clipper")) -> dict:
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    if "admin" in user_roles(user):
        return c
    proj = await db.projects.find_one({"id": c["project_id"]}, NO_ID) or {}
    is_customer = proj.get("owner_id") == user["id"]
    is_clipper = c.get("clipper_id") == user["id"]
    if ("customer" in allow and is_customer) or ("clipper" in allow and is_clipper):
        return c
    raise HTTPException(403, "You are not a party to this contract")


async def _issue(user: dict) -> dict:
    token = auth.create_access_token(user["id"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


async def _ensure_clipper_profile(user: dict):
    if "clipper" not in user_roles(user) or await db.clippers.find_one({"id": user["id"]}):
        return
    await db.clippers.insert_one({
        "id": user["id"], "name": user["name"],
        "avatar": user.get("avatar") or f"https://i.pravatar.cc/150?u={user['id']}",
        "specialty": "New Clipper", "rating": 0, "on_time_pct": 100, "completed_jobs": 0,
        "price_range": "$20-$100", "badge": "New", "missed_deadlines": 0, "repeat_clients": 0,
        "ratings": {"editing": 0, "brief_match": 0, "communication": 0}, "earnings": 0,
        "bond_balance": 0, "tools": [], "portfolio": [], "reviews": [], "status": "approved",
    })


async def ensure_auth_setup():
    await db.users.create_index("email", unique=True)
    for role, u in DEMO_USERS.items():
        await db.users.update_one(
            {"id": u["id"]},
            {"$setOnInsert": {**u, "auth_provider": "demo", "hashed_password": None,
                              "disabled": False, "created_at": now_iso()}},
            upsert=True)
    # Backfill: any pre-multi-role user gets roles=[legacy role] and is treated
    # as already onboarded so existing accounts are never locked out or forced
    # back through the wizard.
    async for u in db.users.find({"roles": {"$exists": False}}, {"id": 1, "role": 1}):
        await db.users.update_one(
            {"id": u["id"]},
            {"$set": {"roles": [u["role"]] if u.get("role") else [], "onboarded": True}})
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    if admin_email and admin_pw:
        admin_fields = {"hashed_password": auth.hash_password(admin_pw), "role": "admin",
                        "roles": ["customer", "clipper", "admin"], "onboarded": True, "disabled": False}
        existing = await db.users.find_one({"email": admin_email})
        if existing:
            await db.users.update_one({"email": admin_email}, {"$set": admin_fields})
        else:
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": admin_email, "name": "Administrator",
                                       "credits": 0, "auth_provider": "local", "created_at": now_iso(),
                                       **admin_fields})
        logger.info("Admin account ensured for %s", admin_email)
    else:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD not set — no real admin account provisioned.")


@api_router.post("/auth/register")
async def register(body: RegisterRequest, request: Request):
    if not auth.rate_limit(f"reg:{client_ip(request)}", 10, 3600):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    # Real capabilities are chosen in onboarding; `body.role` is only a UI hint
    # for the default dashboard. New accounts start with no capabilities and are
    # routed through the wizard.
    hint = body.role if body.role in ("customer", "clipper") else "customer"
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists")
    user = {
        "id": str(uuid.uuid4()), "email": email, "name": body.name.strip(), "role": hint,
        "roles": [], "onboarded": False,
        "hashed_password": auth.hash_password(body.password), "auth_provider": "local",
        "credits": 0, "disabled": False, "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    return await _issue(user)


@api_router.post("/auth/login")
async def login(body: LoginRequest, request: Request):
    if not auth.rate_limit(f"login:{client_ip(request)}", 15, 900):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not auth.verify_password(body.password, user.get("hashed_password")):
        raise HTTPException(401, "Invalid email or password")
    if user.get("disabled"):
        raise HTTPException(403, "Account disabled")
    return await _issue(user)


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/switch-role")
async def switch_role(body: SwitchRoleRequest, user: dict = Depends(get_current_user)):
    """Flip the active dashboard mode for a multi-role account. Re-issues a JWT
    whose active `role` is the requested capability. No re-login, no password."""
    if body.role not in user_roles(user):
        raise HTTPException(403, "You don't have that role")
    await db.users.update_one({"id": user["id"]}, {"$set": {"role": body.role}})
    user["role"] = body.role
    return await _issue(user)


@api_router.post("/auth/onboarding")
async def complete_onboarding(body: OnboardingRequest, user: dict = Depends(get_current_user)):
    """Finish signup: set the account's capabilities, seed a brand profile and/or
    clipper profile, grant customer credits once, and mark onboarded."""
    roles = [r for r in ("customer", "clipper") if r in body.roles]
    if not roles:
        raise HTTPException(400, "Pick at least one role")
    # Preserve any existing capabilities (e.g. admin) and add the new ones.
    prev = set(user_roles(user))
    merged = list(prev | set(roles))
    active = body.active_role if body.active_role in merged else roles[0]

    update = {"roles": merged, "onboarded": True, "role": active}
    # Grant the customer starter credits only the first time customer is added.
    if "customer" in roles and "customer" not in prev and not user.get("credits"):
        update["credits"] = 150
    if body.payout_wallet.strip():
        update["payout_wallet"] = body.payout_wallet.strip()
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    user.update(update)

    # Seed a brand profile from the creator answers (id is deterministic per user).
    if "customer" in roles and (body.brand_name or body.niche or body.content_type):
        pid = f"brand-{user['id']}"
        if not await db.brand_profiles.find_one({"id": pid}):
            await db.brand_profiles.insert_one({
                "id": pid, "owner": user["id"],
                "name": body.brand_name or user.get("name", ""),
                "description": body.niche, "audience": body.audience,
                "caption_style": "", "pacing": "", "cta": "", "avoid": "",
                "fonts": "", "content_type": body.content_type, "platforms": body.platforms,
            })

    # Ensure the clipper profile exists, then apply any specialties/tools/samples.
    if "clipper" in roles:
        await _ensure_clipper_profile(user)
        clip_update = {}
        if body.specialties:
            clip_update["specialty"] = ", ".join(body.specialties[:3])
        if body.tools:
            clip_update["tools"] = body.tools
        if body.samples:
            clip_update["portfolio"] = [{"url": s} for s in body.samples]
        if clip_update:
            await db.clippers.update_one({"id": user["id"]}, {"$set": clip_update})

    return await _issue(user)


@api_router.post("/auth/google")
async def google_auth(body: GoogleAuthRequest):
    try:
        info = auth.verify_google_credential(body.credential)
    except RuntimeError:
        raise HTTPException(503, "Google sign-in is not configured on this server")
    except Exception:
        raise HTTPException(401, "Invalid Google credential")
    email = info["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        hint = body.role if body.role in ("customer", "clipper") else "customer"
        user = {
            "id": str(uuid.uuid4()), "email": email,
            "name": info.get("name") or email.split("@")[0], "role": hint,
            "roles": [], "onboarded": False,
            "hashed_password": None, "auth_provider": "google", "avatar": info.get("picture"),
            "credits": 0, "disabled": False, "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
    if user.get("disabled"):
        raise HTTPException(403, "Account disabled")
    return await _issue(user)


@api_router.post("/auth/demo")
async def demo_login(body: DemoLoginRequest):
    if os.environ.get("ENABLE_DEMO_LOGIN", "true").lower() != "true":
        raise HTTPException(403, "Demo login is disabled")
    role = body.role if body.role in DEMO_USERS else "customer"
    if role == "admin" and os.environ.get("ENABLE_DEMO_ADMIN", "false").lower() != "true":
        raise HTTPException(403, "Demo admin access is disabled")
    u = await db.users.find_one({"id": DEMO_USERS[role]["id"]})
    if not u:
        raise HTTPException(404, "Demo user unavailable")
    return await _issue(u)
# ========================== END AUTH ==========================


# ============================ MEDIA / UPLOADS ============================
@api_router.post("/uploads")
async def upload_media(kind: str = Form("source"), contract_id: Optional[str] = Form(None),
                       file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    ext = ext if len(ext) <= 10 and ext.startswith(".") else ""
    uid = uuid.uuid4().hex
    if kind == "delivery":
        if not contract_id:
            raise HTTPException(400, "contract_id required for a delivery upload")
        await _require_contract_party(contract_id, user, allow=("clipper",))
        key = f"deliveries/{contract_id}/{uid}{ext}"
    else:
        if not ({"customer", "admin"} & set(user_roles(user))):
            raise HTTPException(403, "Only customers upload source footage")
        key = f"sources/{user['id']}/{uid}{ext}"
    try:
        size = await storage.save_upload(file, key)
    except storage.UploadError as e:
        raise HTTPException(e.status, e.message)
    return {"key": key, "name": file.filename, "size": size}


@api_router.get("/media/{key:path}")
async def get_media(key: str, exp: Optional[int] = None, sig: Optional[str] = None):
    # The signature is the capability — authorization happened when it was minted.
    if not storage.verify_media(key, exp, sig):
        raise HTTPException(403, "Invalid or expired media link")
    path = storage.safe_path(key)
    if path is None or not path.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(path)


@api_router.get("/projects/{project_id}/source-url")
async def project_source_url(project_id: str, user: dict = Depends(get_current_user)):
    p = await db.projects.find_one({"id": project_id}, NO_ID)
    if not p:
        raise HTTPException(404, "Project not found")
    if not p.get("source_key"):
        raise HTTPException(404, "No uploaded source footage")
    allowed = "admin" in user_roles(user) or p.get("owner_id") == user["id"]
    if not allowed:
        # A clipper who has bid on or holds a contract for this project may fetch it.
        has_bid = await db.bids.find_one({"project_id": project_id, "clipper_id": user["id"]})
        has_contract = await db.contracts.find_one({"project_id": project_id, "clipper_id": user["id"]})
        allowed = bool(has_bid or has_contract)
    if not allowed:
        raise HTTPException(403, "Not authorized to access this footage")
    return {"url": storage.sign_media_url(p["source_key"])}
# ========================== END MEDIA / UPLOADS ==========================


def _sign_versions(version: dict) -> dict:
    """Replace a delivered version's stored key with a fresh signed playback URL."""
    if version.get("key"):
        version["url"] = storage.sign_media_url(version["key"])
    return version


def _sign_contract_media(contract: dict) -> dict:
    for v in (contract.get("versions") or []):
        _sign_versions(v)
    return contract


def _sign_clipper(c):
    """If the clipper uploaded an avatar, serve it via a fresh signed media URL."""
    if c and c.get("avatar_key"):
        c["avatar"] = storage.sign_media_url(c["avatar_key"])
    return c


async def attach_clipper(items):
    ids = list({i["clipper_id"] for i in items})
    clippers = await db.clippers.find({"id": {"$in": ids}}, NO_ID).to_list(50)
    cmap = {c["id"]: _sign_clipper(c) for c in clippers}
    for i in items:
        i["clipper"] = cmap.get(i["clipper_id"])
    return items


@api_router.get("/")
async def root():
    return {"message": "24 Hour Clipping API", "status": "live"}

@api_router.post("/demo/reset")
async def reset_demo(user: dict = Depends(require_role("admin"))):
    await seed_db(db)
    return {"ok": True}

@api_router.get("/clippers")
async def get_clippers():
    clippers = await db.clippers.find({}, NO_ID).to_list(100)
    return [_sign_clipper(c) for c in clippers]

@api_router.get("/clippers/{clipper_id}")
async def get_clipper(clipper_id: str):
    c = await db.clippers.find_one({"id": clipper_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Clipper not found")
    return _sign_clipper(c)

@api_router.get("/projects")
async def get_projects(status: Optional[str] = None, category: Optional[str] = None,
                       mine: bool = False, user: Optional[dict] = Depends(get_current_user_optional)):
    q = {}
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    if mine:
        if not user:
            raise HTTPException(401, "Not authenticated")
        q["owner_id"] = user["id"]
    return await db.projects.find(q, NO_ID).sort("posted_at", -1).to_list(200)

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str):
    p = await db.projects.find_one({"id": project_id}, NO_ID)
    if not p:
        raise HTTPException(404, "Project not found")
    return p

@api_router.post("/projects")
async def create_project(body: ProjectCreate, user: dict = Depends(require_role("customer", "admin"))):
    doc = body.model_dump()
    # Uploaded thumbnail -> a long-lived signed URL usable in <img> anywhere.
    if body.thumbnail_key:
        thumb = storage.sign_media_url(body.thumbnail_key, expires_in=365 * 24 * 3600)
    else:
        thumb = body.thumbnail or "https://images.pexels.com/photos/14540970/pexels-photo-14540970.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    doc.pop("thumbnail_key", None)
    doc.update({
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "customer_name": user.get("name") or body.customer_name,
        "bond": bond_for(body.budget),
        "status": "draft",
        "funded": False,
        "bids_count": 0,
        "posted_at": now_iso(),
        "timestamp_provided": body.moment_mode == "known",
        "thumbnail": thumb,
    })
    await db.projects.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.post("/projects/{project_id}/fund")
async def fund_project(project_id: str, body: FundRequest, user: dict = Depends(get_current_user)):
    await _require_project_owner(project_id, user)
    tx = "5KJp" + uuid.uuid4().hex[:20] + "SoL" if body.payment_method == "usdc" else None
    r = await db.projects.update_one({"id": project_id}, {"$set": {"funded": True, "status": "open", "payment_method": body.payment_method, "tx_hash": tx}})
    if not r.matched_count:
        raise HTTPException(404, "Project not found")
    return {"ok": True, "tx_hash": tx}


@api_router.post("/projects/{project_id}/checkout")
async def create_card_checkout(project_id: str, user: dict = Depends(get_current_user)):
    p = await _require_project_owner(project_id, user)
    # Ziina is preferred when configured; Stripe is the fallback provider.
    if ziina.is_configured():
        try:
            intent = ziina.create_payment_intent(p)
        except Exception as e:
            logger.error("Ziina checkout error: %s", e)
            raise HTTPException(502, "Could not start card checkout")
        await db.projects.update_one({"id": project_id}, {"$set": {"ziina_payment_id": intent["id"]}})
        return {"url": intent["url"], "provider": "ziina", "test_mode": ziina.ZIINA_TEST}
    if payments.is_configured():
        try:
            url = payments.create_checkout_session(p)
        except Exception as e:
            logger.error("Stripe checkout error: %s", e)
            raise HTTPException(502, "Could not start card checkout")
        return {"url": url, "provider": "stripe", "test_mode": payments.is_test_mode()}
    raise HTTPException(503, "Card payments are not configured on this server")


@api_router.post("/projects/{project_id}/checkout/confirm")
async def confirm_card_checkout(project_id: str, body: dict, user: dict = Depends(get_current_user)):
    p = await _require_project_owner(project_id, user)
    if ziina.is_configured():
        ref = p.get("ziina_payment_id")
        if not ref:
            raise HTTPException(400, "No pending Ziina payment for this project")
        try:
            status = ziina.get_status(ref)
        except Exception as e:
            logger.error("Ziina confirm error: %s", e)
            raise HTTPException(502, "Could not verify payment")
        if status != "completed":
            raise HTTPException(402, f"Payment not completed (status: {status})")
        await db.projects.update_one({"id": project_id}, {"$set": {"funded": True, "status": "open", "payment_method": "ziina", "tx_hash": ref}})
        return {"ok": True}
    if payments.is_configured():
        session_id = (body or {}).get("session_id")
        if not session_id:
            raise HTTPException(400, "session_id required")
        try:
            paid = payments.session_is_paid(session_id, project_id)
        except Exception as e:
            logger.error("Stripe confirm error: %s", e)
            raise HTTPException(502, "Could not verify payment")
        if not paid:
            raise HTTPException(402, "Payment not completed")
        await db.projects.update_one({"id": project_id}, {"$set": {"funded": True, "status": "open", "payment_method": "card", "tx_hash": session_id}})
        return {"ok": True}
    raise HTTPException(503, "Card payments are not configured on this server")

# ============================ SOLANA USDC ============================
@api_router.get("/solana/config")
async def solana_config():
    """Non-secret config the frontend needs to build a USDC transfer."""
    cfg = solpay.config_public()
    cfg["test_mode"] = await get_test_mode()
    return cfg


@api_router.post("/projects/{project_id}/fund/test")
async def fund_test(project_id: str, user: dict = Depends(get_current_user)):
    """Simulated funding for presentations — only works while test mode is on."""
    await _require_project_owner(project_id, user)
    if not await get_test_mode():
        raise HTTPException(403, "Test mode is off")
    await db.projects.update_one({"id": project_id}, {"$set": {
        "funded": True, "status": "open", "payment_method": "test",
        "tx_hash": "TEST-" + uuid.uuid4().hex[:12]}})
    return {"ok": True, "test": True}


@api_router.get("/projects/{project_id}/solana/deposit-info")
async def solana_deposit_info(project_id: str, user: dict = Depends(get_current_user)):
    p = await _require_project_owner(project_id, user)
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payments are not configured on this server")
    budget = float(p["budget"])
    options = {"usdc": {"amount": budget}}
    try:
        price = await asyncio.to_thread(solpay.get_sol_price_usd)
        options["sol"] = {"amount": round(budget / price, 6), "price": price}
    except Exception as e:
        logger.warning("SOL price fetch failed: %s", e)  # USDC still offered
    return {"treasury": solpay.treasury_pubkey(), "budget": budget, "amount": budget,
            "usdc_mint": solpay.USDC_MINT_STR, "network": solpay.NETWORK,
            "decimals": solpay.DECIMALS, "options": options}


@api_router.post("/projects/{project_id}/fund/solana")
async def solana_fund(project_id: str, body: SolanaFundRequest, user: dict = Depends(get_current_user)):
    p = await _require_project_owner(project_id, user)
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payments are not configured on this server")
    currency = "sol" if body.currency == "sol" else "usdc"
    sig = body.signature.strip()
    # Anti-replay: a deposit signature can only fund one project.
    if await db.projects.find_one({"solana_deposit_sig": sig}):
        raise HTTPException(409, "This payment has already been used")
    try:
        res = await asyncio.to_thread(solpay.verify_deposit, sig, float(p["budget"]), currency)
    except solpay.PaymentError as e:
        raise HTTPException(402, f"Payment not verified: {e}")
    except Exception as e:
        logger.error("Solana deposit verify error: %s", e)
        raise HTTPException(502, "Could not verify the Solana payment")
    await db.projects.update_one({"id": project_id}, {"$set": {
        "funded": True, "status": "open", "payment_method": f"solana_{currency}",
        "tx_hash": sig, "solana_deposit_sig": sig,
        "escrow_amount": res["received"], "escrow_currency": currency}})
    return {"ok": True, "received": res["received"], "currency": currency, "signature": sig}


@api_router.get("/me/payout-wallet")
async def get_payout_wallet(user: dict = Depends(get_current_user)):
    return {"wallet": user.get("payout_wallet")}


@api_router.post("/me/payout-wallet")
async def set_payout_wallet(body: PayoutWalletRequest, user: dict = Depends(get_current_user)):
    wallet = body.wallet.strip()
    if not solpay.is_valid_pubkey(wallet):
        raise HTTPException(400, "That is not a valid Solana wallet address")
    await db.users.update_one({"id": user["id"]}, {"$set": {"payout_wallet": wallet}})
    # keep the public clipper profile in sync so customers can see they're payable
    await db.clippers.update_one({"id": user["id"]}, {"$set": {"payout_wallet": wallet}})
    return {"ok": True, "wallet": wallet}


class ClipperProfileUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    price_range: Optional[str] = None
    tools: Optional[List[str]] = None
    bio: Optional[str] = None
    avatar_key: Optional[str] = None   # from POST /uploads (kind=source)
    avatar_url: Optional[str] = None   # external URL alternative


@api_router.put("/me/clipper-profile")
async def update_clipper_profile(body: ClipperProfileUpdate, user: dict = Depends(require_role("clipper", "admin"))):
    await _ensure_clipper_profile(user)
    updates = {}
    if body.name and body.name.strip():
        updates["name"] = body.name.strip()[:60]
        await db.users.update_one({"id": user["id"]}, {"$set": {"name": updates["name"]}})
    if body.specialty is not None:
        updates["specialty"] = body.specialty.strip()[:60] or "New Clipper"
    if body.price_range is not None:
        updates["price_range"] = body.price_range.strip()[:40]
    if body.tools is not None:
        updates["tools"] = [t.strip() for t in body.tools if t.strip()][:12]
    if body.bio is not None:
        updates["bio"] = body.bio.strip()[:600]
    if body.avatar_key:
        updates["avatar_key"] = body.avatar_key            # signed on read
    elif body.avatar_url:
        updates["avatar"] = body.avatar_url.strip()
        updates["avatar_key"] = None
    if updates:
        await db.clippers.update_one({"id": user["id"]}, {"$set": updates})
    c = await db.clippers.find_one({"id": user["id"]}, NO_ID)
    return _sign_clipper(c)


async def _pay_contract(contract: dict) -> dict:
    """Send the clipper's payout (in the escrow currency) for a completed contract (idempotent)."""
    if contract.get("payout_sig"):
        return {"already_paid": True, "signature": contract["payout_sig"]}
    clipper = await db.users.find_one({"id": contract["clipper_id"]}, NO_ID)
    wallet = (clipper or {}).get("payout_wallet")
    if not wallet:
        raise HTTPException(409, "Clipper has not set a Solana payout wallet yet")
    proj = await db.projects.find_one({"id": contract["project_id"]}, NO_ID) or {}
    currency = proj.get("escrow_currency", "usdc")
    split = solpay.payout_split(contract["price"])
    try:
        pay = await asyncio.to_thread(solpay.send_payout, wallet, split["clipper"], currency)
    except solpay.PaymentError as e:
        raise HTTPException(502, f"Payout failed: {e}")
    except Exception as e:
        logger.error("Solana payout error: %s", e)
        raise HTTPException(502, "Payout failed — check treasury balance and try again")
    await db.contracts.update_one({"id": contract["id"]}, {"$set": {
        "payout_sig": pay["signature"], "payout_amount": split["clipper"],
        "payout_currency": pay["currency"], "payout_sent": pay["amount"], "fee_amount": split["fee"],
        "payout_wallet": wallet, "payout_at": now_iso()}})
    return {"paid": True, "signature": pay["signature"], "currency": pay["currency"],
            "sent": pay["amount"], **split}


@api_router.post("/contracts/{contract_id}/payout")
async def contract_payout(contract_id: str, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user, allow=("customer",))
    if c.get("status") != "completed":
        raise HTTPException(409, "Contract must be approved/completed before payout")
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payouts are not configured on this server")
    return await _pay_contract(c)


@api_router.post("/contracts/{contract_id}/tip")
async def contract_tip(contract_id: str, body: TipRequest, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user, allow=("customer",))
    currency = "sol" if body.currency == "sol" else "usdc"
    # Test mode: record the tip without an on-chain transfer.
    if await get_test_mode():
        await db.messages.insert_one({"id": str(uuid.uuid4()), "contract_id": contract_id,
            "sender": "customer", "text": f"💜 Tipped the clipper {body.amount} {currency.upper()} (test mode)",
            "tip_amount": float(body.amount), "tip_currency": currency, "created_at": now_iso()})
        return {"ok": True, "amount": float(body.amount), "currency": currency, "test": True}
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payments are not configured on this server")
    clipper = await db.users.find_one({"id": c["clipper_id"]}, NO_ID)
    wallet = (clipper or {}).get("payout_wallet")
    if not wallet:
        raise HTTPException(409, "Clipper has not set a Solana wallet yet")
    sig = body.signature.strip()
    if await db.messages.find_one({"tip_sig": sig}):
        raise HTTPException(409, "This tip has already been recorded")
    try:
        received = await asyncio.to_thread(solpay.verify_tip, sig, wallet, float(body.amount), currency)
    except solpay.PaymentError as e:
        raise HTTPException(402, f"Tip not verified: {e}")
    except Exception as e:
        logger.error("Solana tip verify error: %s", e)
        raise HTTPException(502, "Could not verify the tip")
    unit = currency.upper()
    await db.messages.insert_one({"id": str(uuid.uuid4()), "contract_id": contract_id,
        "sender": "customer", "text": f"💜 Tipped the clipper {received} {unit} (no fee)",
        "tip_sig": sig, "tip_amount": received, "tip_currency": currency, "created_at": now_iso()})
    return {"ok": True, "amount": received, "currency": currency, "signature": sig}
# ========================== END SOLANA USDC ==========================


@api_router.get("/projects/{project_id}/bids")
async def get_bids(project_id: str):
    bids = await db.bids.find({"project_id": project_id}, NO_ID).sort("created_at", -1).to_list(100)
    return await attach_clipper(bids)

@api_router.post("/projects/{project_id}/bids")
async def create_bid(project_id: str, body: BidCreate, user: dict = Depends(require_role("clipper", "admin"))):
    project = await db.projects.find_one({"id": project_id}, NO_ID)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.get("status") not in ("open", None):
        raise HTTPException(409, "This project is not accepting bids")
    await _ensure_clipper_profile(user)
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()), "project_id": project_id,
        "clipper_id": user["id"],  # identity comes from the token, never the request body
        "bond_required": bond_for(body.amount), "status": "pending", "created_at": now_iso(),
    })
    await db.bids.insert_one(dict(doc))
    await db.projects.update_one({"id": project_id}, {"$inc": {"bids_count": 1}})
    doc.pop("_id", None)
    return (await attach_clipper([doc]))[0]

DEMO_PITCHES = [
    "Hook locked in the first 1.5 seconds. Let's go.",
    "This is exactly my lane — check my last three clips.",
    "I can start right now. First cut well under deadline.",
    "Punch-ins, sound design, captions on point. Done it 200 times.",
    "Your audience will not scroll past this. Guaranteed pacing.",
    "Clean premium edit, beat-synced cuts, delivered early.",
]


@api_router.post("/projects/{project_id}/demo-bids")
async def demo_bids(project_id: str, count: int = 2, user: dict = Depends(get_current_user)):
    """Populate a project's bid room with realistic bids from seed clippers.
    Owner-only; available in test/demo mode (or to admins). Idempotent up to `count`."""
    p = await _require_project_owner(project_id, user)
    if not await get_test_mode() and "admin" not in user_roles(user):
        raise HTTPException(403, "Demo bids are only available in test mode")
    import random
    existing = await db.bids.find({"project_id": project_id}, NO_ID).to_list(100)
    have = {b["clipper_id"] for b in existing}
    target = max(0, int(count) - len(existing))
    if target <= 0:
        return []
    clippers = await db.clippers.find({"id": {"$nin": list(have)}}, NO_ID).to_list(50)
    random.shuffle(clippers)
    created = []
    for c in clippers[:target]:
        amount = max(20, round(float(p["budget"]) * (0.75 + random.random() * 0.35)))
        doc = {"id": str(uuid.uuid4()), "project_id": project_id, "clipper_id": c["id"],
               "amount": amount, "pitch": random.choice(DEMO_PITCHES),
               "eta_hours": 6 + random.randint(0, 13), "bond_required": bond_for(amount),
               "status": "pending", "created_at": now_iso()}
        await db.bids.insert_one(dict(doc))
        doc.pop("_id", None)
        created.append(doc)
    if created:
        await db.projects.update_one({"id": project_id}, {"$inc": {"bids_count": len(created)}})
    return await attach_clipper(created)


@api_router.post("/bids/{bid_id}/accept")
async def accept_bid(bid_id: str, user: dict = Depends(get_current_user)):
    bid = await db.bids.find_one({"id": bid_id}, NO_ID)
    if not bid:
        raise HTTPException(404, "Bid not found")
    await _require_project_owner(bid["project_id"], user)
    await db.bids.update_one({"id": bid_id}, {"$set": {"status": "accepted"}})
    # Accepting = the deal is on: the contract goes live and the 24h clock starts,
    # so the clipper immediately sees it on their dashboard and can deliver.
    # (A project can accept several clippers — each gets its own live contract.)
    started = datetime.now(timezone.utc)
    deadline = started + timedelta(hours=24)
    contract = {
        "id": str(uuid.uuid4()), "project_id": bid["project_id"], "clipper_id": bid["clipper_id"],
        "price": bid["amount"], "bond": bid["bond_required"], "status": "live",
        "started_at": started.isoformat(), "deadline_at": deadline.isoformat(),
        "versions": [], "payment_method": "escrow", "rating_given": None,
    }
    await db.contracts.insert_one(dict(contract))
    await db.projects.update_one({"id": bid["project_id"]}, {"$set": {"status": "contract_live"}})
    # Email the accepted clipper (registered users only; never blocks acceptance).
    try:
        clip_user = await db.users.find_one({"id": bid["clipper_id"]}, NO_ID)
        proj = await db.projects.find_one({"id": bid["project_id"]}, NO_ID) or {}
        if clip_user and clip_user.get("email"):
            title = proj.get("title", "your project")
            html = _acceptance_email_html(clip_user.get("name") or "there", title, bid["amount"], deadline.isoformat())
            await asyncio.to_thread(send_email, clip_user["email"], f"You're hired — {title}", html)
    except Exception as e:
        logger.error("acceptance email error: %s", e)
    contract.pop("_id", None)
    return contract

async def _bid_party(bid_id: str, user: dict):
    """A bid conversation is between the project owner and the bidding clipper."""
    bid = await db.bids.find_one({"id": bid_id}, NO_ID)
    if not bid:
        raise HTTPException(404, "Bid not found")
    proj = await db.projects.find_one({"id": bid["project_id"]}, NO_ID) or {}
    is_owner = proj.get("owner_id") == user["id"]
    is_clipper = bid.get("clipper_id") == user["id"]
    if user["role"] == "admin" or is_owner or is_clipper:
        return bid, is_owner
    raise HTTPException(403, "You are not part of this conversation")


@api_router.get("/bids/{bid_id}/messages")
async def get_bid_messages(bid_id: str, user: dict = Depends(get_current_user)):
    await _bid_party(bid_id, user)
    return await db.messages.find({"bid_id": bid_id}, NO_ID).sort("created_at", 1).to_list(300)


@api_router.post("/bids/{bid_id}/messages")
async def post_bid_message(bid_id: str, body: MessageCreate, user: dict = Depends(get_current_user)):
    bid, is_owner = await _bid_party(bid_id, user)
    sender = "admin" if user["role"] == "admin" else ("customer" if is_owner else "clipper")
    doc = {"id": str(uuid.uuid4()), "bid_id": bid_id, "project_id": bid["project_id"],
           "sender": sender, "sender_name": user.get("name"), "text": body.text, "created_at": now_iso()}
    await db.messages.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/contracts")
async def get_contracts(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"status": status} if status else {}
    contracts = await db.contracts.find(q, NO_ID).to_list(200)
    # Scope to the caller: clippers see their own, customers see contracts on
    # projects they own, admins see everything.
    if user["role"] == "clipper":
        contracts = [c for c in contracts if c["clipper_id"] == user["id"]]
    elif user["role"] == "customer":
        pids = [c["project_id"] for c in contracts]
        owned = {p["id"] for p in await db.projects.find(
            {"id": {"$in": pids}, "owner_id": user["id"]}, {"id": 1, "_id": 0}).to_list(500)}
        contracts = [c for c in contracts if c["project_id"] in owned]
    contracts = await attach_clipper(contracts)
    pids = list({c["project_id"] for c in contracts})
    projects = await db.projects.find({"id": {"$in": pids}}, NO_ID).to_list(200)
    pmap = {p["id"]: p for p in projects}
    for c in contracts:
        c["project"] = pmap.get(c["project_id"])
        _sign_contract_media(c)
    return contracts

@api_router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user)
    c = (await attach_clipper([c]))[0]
    c["project"] = await db.projects.find_one({"id": c["project_id"]}, NO_ID)
    _sign_contract_media(c)
    return c

@api_router.post("/contracts/{contract_id}/activate")
async def activate_contract(contract_id: str, user: dict = Depends(get_current_user)):
    started = datetime.now(timezone.utc)
    deadline = started + timedelta(hours=24)
    c = await _require_contract_party(contract_id, user, allow=("clipper",))
    await db.contracts.update_one({"id": contract_id}, {"$set": {
        "status": "live", "started_at": started.isoformat(), "deadline_at": deadline.isoformat()}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "contract_live"}})
    return {"ok": True, "deadline_at": deadline.isoformat()}

@api_router.post("/contracts/{contract_id}/deliver")
async def deliver(contract_id: str, body: DeliveryCreate, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user, allow=("clipper",))
    version = {
        "num": len(c.get("versions", [])) + 1,
        "key": body.key,
        "url": None if body.key else (body.url or "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"),
        "thumb": None, "note": body.note or "First cut submitted.", "submitted_at": now_iso(),
    }
    await db.contracts.update_one({"id": contract_id}, {"$push": {"versions": version}, "$set": {"status": "delivered"}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "delivered"}})
    version = _sign_versions(version)
    return version

@api_router.post("/contracts/{contract_id}/revision")
async def request_revision(contract_id: str, body: MessageCreate, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user, allow=("customer",))
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "revision"}})
    await db.messages.insert_one({"id": str(uuid.uuid4()), "contract_id": contract_id,
                                  "sender": "customer", "text": f"REVISION REQUEST: {body.text}", "created_at": now_iso()})
    return {"ok": True}

@api_router.post("/contracts/{contract_id}/approve")
async def approve(contract_id: str, body: RateRequest, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user, allow=("customer",))
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "completed", "rating_given": body.rating}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "completed"}})
    split = solpay.payout_split(c["price"])
    resp = {"ok": True, "payout": split["clipper"], "fee": split["fee"], "bond_returned": c["bond"]}
    proj = await db.projects.find_one({"id": c["project_id"]}, NO_ID) or {}
    # Test mode (or a test-funded project): simulate the payout, no on-chain money.
    if await get_test_mode() or proj.get("payment_method") == "test":
        resp["paid"] = True
        resp["test"] = True
    # If Solana escrow funded this project, pay the clipper their USDC/SOL now.
    elif solpay.is_configured() and str(proj.get("payment_method", "")).startswith("solana"):
        try:
            fresh = await db.contracts.find_one({"id": contract_id}, NO_ID)
            pay = await _pay_contract(fresh)
            resp["payout_signature"] = pay.get("signature")
            resp["paid"] = True
        except HTTPException as e:
            # Don't fail the approval if payout can't complete; surface it for retry.
            resp["paid"] = False
            resp["payout_error"] = e.detail
    return resp

@api_router.post("/contracts/{contract_id}/rescue")
async def trigger_rescue(contract_id: str, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user, allow=("customer",))
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "rescue"}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "rescue"}})
    return {"ok": True, "refund": c["price"], "bond_credit": c["bond"]}

@api_router.post("/contracts/{contract_id}/relaunch")
async def relaunch(contract_id: str, user: dict = Depends(get_current_user)):
    c = await _require_contract_party(contract_id, user, allow=("customer",))
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "open", "posted_at": now_iso(), "priority": True}})
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "closed_rescued"}})
    return {"ok": True}

@api_router.get("/contracts/{contract_id}/messages")
async def get_messages(contract_id: str, user: dict = Depends(get_current_user)):
    await _require_contract_party(contract_id, user)
    return await db.messages.find({"contract_id": contract_id}, NO_ID).sort("created_at", 1).to_list(200)

@api_router.post("/contracts/{contract_id}/messages")
async def post_message(contract_id: str, body: MessageCreate, user: dict = Depends(get_current_user)):
    await _require_contract_party(contract_id, user)
    # Sender is derived from the caller's role, not trusted from the request.
    sender = "admin" if user["role"] == "admin" else user["role"]
    doc = {"id": str(uuid.uuid4()), "contract_id": contract_id, "sender": sender,
           "text": body.text, "created_at": now_iso()}
    await db.messages.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.get("/brand-profiles")
async def get_brand_profiles(user: dict = Depends(get_current_user)):
    if "admin" in user_roles(user):
        return await db.brand_profiles.find({}, NO_ID).to_list(50)
    return await db.brand_profiles.find({"owner": user["id"]}, NO_ID).to_list(20)

@api_router.put("/brand-profiles/{profile_id}")
async def update_brand_profile(profile_id: str, body: BrandProfileUpdate, user: dict = Depends(get_current_user)):
    existing = await db.brand_profiles.find_one({"id": profile_id}, NO_ID)
    if existing and "admin" not in user_roles(user) and existing.get("owner") != user["id"]:
        raise HTTPException(403, "You do not own this brand profile")
    update = body.model_dump()
    update["owner"] = existing.get("owner", user["id"]) if existing else user["id"]
    await db.brand_profiles.update_one({"id": profile_id}, {"$set": update}, upsert=True)
    return await db.brand_profiles.find_one({"id": profile_id}, NO_ID)

@api_router.get("/admin/overview")
async def admin_overview(user: dict = Depends(require_role("admin"))):
    projects = await db.projects.find({}, NO_ID).to_list(300)
    contracts = await db.contracts.find({}, NO_ID).to_list(300)
    contracts = await attach_clipper(contracts)
    pmap = {p["id"]: p for p in projects}
    for c in contracts:
        c["project"] = pmap.get(c["project_id"])
        _sign_contract_media(c)
    bids = await db.bids.find({}, NO_ID).to_list(300)
    clippers = await db.clippers.find({}, NO_ID).to_list(100)
    completed = [c for c in contracts if c["status"] == "completed"]
    total_users = await db.users.count_documents({})
    return {
        "stats": {
            "total_users": total_users,
            "total_projects": len(projects),
            "open_projects": len([p for p in projects if p["status"] == "open"]),
            "live_contracts": len([c for c in contracts if c["status"] == "live"]),
            "rescue_mode": len([c for c in contracts if c["status"] == "rescue"]),
            "total_bids": len(bids),
            "clippers": len(clippers),
            "fees_earned": round(sum(c["price"] * 0.08 for c in completed), 2),
            "bonds_locked": round(sum(c["bond"] for c in contracts if c["status"] in ("live", "delivered", "revision")), 2),
        },
        "projects": projects, "contracts": contracts, "bids": bids, "clippers": clippers,
    }


@api_router.get("/admin/test-mode")
async def admin_get_test_mode(admin: dict = Depends(require_role("admin"))):
    return {"enabled": await get_test_mode()}


@api_router.post("/admin/test-mode")
async def admin_set_test_mode(body: TestModeRequest, admin: dict = Depends(require_role("admin"))):
    await set_test_mode(body.enabled)
    return {"ok": True, "enabled": body.enabled}


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_role("admin")),
                      q: Optional[str] = None, role: Optional[str] = None):
    query = {}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [{"email": {"$regex": q, "$options": "i"}},
                        {"name": {"$regex": q, "$options": "i"}}]
    return await db.users.find(query, {"_id": 0, "hashed_password": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, admin: dict = Depends(require_role("admin"))):
    target = await db.users.find_one({"id": user_id}, NO_ID)
    if not target:
        raise HTTPException(404, "User not found")
    if target["id"] == admin["id"]:
        raise HTTPException(400, "You cannot suspend yourself")
    if target.get("role") == "admin":
        raise HTTPException(400, "Admin accounts cannot be suspended")
    await db.users.update_one({"id": user_id}, {"$set": {"disabled": True}})
    return {"ok": True}


@api_router.post("/admin/users/{user_id}/restore")
async def admin_restore_user(user_id: str, admin: dict = Depends(require_role("admin"))):
    r = await db.users.update_one({"id": user_id}, {"$set": {"disabled": False}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    return {"ok": True}

# ---------- AI Concierge ----------
CONCIERGE_SYSTEM = """You are the AI Clipping Concierge for 24 Hour Clipping, a marketplace where customers post short-form video clipping projects and trusted clippers deliver a first cut within 24 hours.

Your job: through a SHORT, friendly conversation (max 4-5 questions total, ONE question per message), gather what's needed for a project brief:
- What footage they have (link or upload) and whether they know the exact moment or want the clipper to find the best moment
- Project goal + target audience
- Platform (TikTok / Reels / Shorts), output length (15-90s), aspect ratio (9:16 default)
- Mood, editing style, caption preference, call to action
- Budget ($20-$500)

Rules: Be energetic and concise (2-3 sentences max per reply). Never use emojis. Ask ONE question at a time. When you have enough info, say "I have everything I need — hit Generate Brief and I'll build your one-page project brief."
"""

BRIEF_SYSTEM = """You convert a conversation into a video clipping project brief. Reply ONLY with valid JSON, no markdown fences, with exactly these keys:
{"title": str, "category": str (one of: Stream Highlights, Podcast Clips, TikToks, Reels, YouTube Shorts, Talking-Head, Short Ads), "description": str (2-3 sentences), "goal": str, "audience": str, "platform": str, "output_length": str, "aspect_ratio": str, "captions": str, "mood": str, "style": str, "cta": str, "budget": number (20-500), "moment_mode": "known" or "find", "source_link": str}
Fill sensible defaults for anything not discussed. Budget must be a number."""

async def get_history(session_id):
    return await db.ai_messages.find({"session_id": session_id}, NO_ID).sort("created_at", 1).to_list(100)

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

def _openai_client():
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "AI features require OPENAI_API_KEY to be set in backend/.env.")
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=key)


@api_router.post("/ai/chat")
async def ai_chat(body: ChatRequest, user: dict = Depends(require_role("customer", "admin"))):
    client = _openai_client()
    history = await get_history(body.session_id)
    messages = [{"role": "system", "content": CONCIERGE_SYSTEM}]
    for m in history[-12:]:
        messages.append({"role": "assistant" if m["sender"] == "ai" else "user", "content": m["text"]})
    messages.append({"role": "user", "content": body.message})
    await db.ai_messages.insert_one({"id": str(uuid.uuid4()), "session_id": body.session_id,
                                     "sender": "user", "text": body.message, "created_at": now_iso()})

    async def gen():
        full = []
        try:
            stream = await client.chat.completions.create(
                model=OPENAI_MODEL, messages=messages, stream=True, temperature=0.6)
            async for chunk in stream:
                delta = (chunk.choices[0].delta.content or "") if chunk.choices else ""
                if delta:
                    full.append(delta)
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as e:
            logger.error(f"AI stream error: {e}")
            yield f"data: {json.dumps({'error': 'The concierge is unavailable right now.'})}\n\n"
        text = "".join(full)
        if text:
            await db.ai_messages.insert_one({"id": str(uuid.uuid4()), "session_id": body.session_id,
                                             "sender": "ai", "text": text, "created_at": now_iso()})
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@api_router.get("/ai/history/{session_id}")
async def ai_history(session_id: str, user: dict = Depends(require_role("customer", "admin"))):
    return await get_history(session_id)

@api_router.post("/ai/brief")
async def ai_brief(body: BriefRequest, user: dict = Depends(require_role("customer", "admin"))):
    client = _openai_client()
    history = await get_history(body.session_id)
    if not history:
        raise HTTPException(400, "No conversation found")
    convo = "\n".join(f"{m['sender']}: {m['text']}" for m in history)
    try:
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL, temperature=0.2, response_format={"type": "json_object"},
            messages=[{"role": "system", "content": BRIEF_SYSTEM},
                      {"role": "user", "content": f"Conversation:\n{convo}\n\nGenerate the brief JSON."}])
    except Exception as e:
        logger.error("AI brief error: %s", e)
        raise HTTPException(502, "Brief generation failed, please try again")
    text = (resp.choices[0].message.content or "").strip()
    if text.startswith("```"):
        text = text.split("```")[1].lstrip("json").strip()
    try:
        brief = json.loads(text)
    except Exception:
        raise HTTPException(500, "Brief generation failed, please try again")
    brief["budget"] = max(20, min(500, float(brief.get("budget", 100))))
    brief["bond"] = bond_for(brief["budget"])
    return brief


app.include_router(api_router)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return resp


app.add_middleware(SecurityHeadersMiddleware)

# We authenticate with Bearer tokens (not cookies), so credentialed CORS is not
# needed — this keeps a wildcard origin valid. Lock CORS_ORIGINS to your domain
# in production for defense in depth.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    storage.ensure_root()
    if os.environ.get("SEED_DEMO_DATA", "true").lower() != "false" and await db.clippers.count_documents({}) == 0:
        await seed_db(db)
        logger.info("Seeded demo data")
    await ensure_auth_setup()
    # Network School showcase (hardcoded real-traction data) — always present, idempotent.
    try:
        from seed_ns import seed_ns
        await seed_ns(db)
        logger.info("NS showcase seeded")
    except Exception as e:
        logger.error("NS seed error: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
