from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
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
    role: str = "customer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str
    role: str = "customer"

class DemoLoginRequest(BaseModel):
    role: str = "customer"


DEMO_USERS = {
    "customer": {"id": "demo-customer", "email": "customer@demo.24hrclipping.com", "name": "Aria Chen", "role": "customer", "credits": 150},
    "clipper":  {"id": "clipper-1",     "email": "clipper@demo.24hrclipping.com",  "name": "Maya Torres", "role": "clipper", "credits": 0},
    "admin":    {"id": "demo-admin",    "email": "admin@demo.24hrclipping.com",    "name": "Demo Admin",  "role": "admin",  "credits": 0},
}

bearer_scheme = HTTPBearer(auto_error=False)


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u.get("email"), "name": u.get("name"),
            "role": u.get("role"), "credits": u.get("credits", 0), "avatar": u.get("avatar")}


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
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return dep


async def _require_project_owner(project_id: str, user: dict) -> dict:
    p = await db.projects.find_one({"id": project_id}, NO_ID)
    if not p:
        raise HTTPException(404, "Project not found")
    if user["role"] != "admin" and p.get("owner_id") != user["id"]:
        raise HTTPException(403, "You do not own this project")
    return p


async def _require_contract_party(contract_id: str, user: dict, allow=("customer", "clipper")) -> dict:
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    if user["role"] == "admin":
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
    if user.get("role") != "clipper" or await db.clippers.find_one({"id": user["id"]}):
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
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    if admin_email and admin_pw:
        existing = await db.users.find_one({"email": admin_email})
        if existing:
            await db.users.update_one({"email": admin_email},
                                      {"$set": {"hashed_password": auth.hash_password(admin_pw), "role": "admin", "disabled": False}})
        else:
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": admin_email, "name": "Administrator",
                                       "role": "admin", "credits": 0, "auth_provider": "local",
                                       "hashed_password": auth.hash_password(admin_pw), "disabled": False,
                                       "created_at": now_iso()})
        logger.info("Admin account ensured for %s", admin_email)
    else:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD not set — no real admin account provisioned.")


@api_router.post("/auth/register")
async def register(body: RegisterRequest, request: Request):
    if not auth.rate_limit(f"reg:{request.client.host}", 10, 3600):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    role = body.role if body.role in ("customer", "clipper") else "customer"
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists")
    user = {
        "id": str(uuid.uuid4()), "email": email, "name": body.name.strip(), "role": role,
        "hashed_password": auth.hash_password(body.password), "auth_provider": "local",
        "credits": 150 if role == "customer" else 0, "disabled": False, "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user))
    await _ensure_clipper_profile(user)
    return await _issue(user)


@api_router.post("/auth/login")
async def login(body: LoginRequest, request: Request):
    if not auth.rate_limit(f"login:{request.client.host}", 15, 900):
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
        role = body.role if body.role in ("customer", "clipper") else "customer"
        user = {
            "id": str(uuid.uuid4()), "email": email,
            "name": info.get("name") or email.split("@")[0], "role": role,
            "hashed_password": None, "auth_provider": "google", "avatar": info.get("picture"),
            "credits": 150 if role == "customer" else 0, "disabled": False, "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
        await _ensure_clipper_profile(user)
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
        if user["role"] not in ("customer", "admin"):
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
    allowed = user["role"] == "admin" or p.get("owner_id") == user["id"]
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


async def attach_clipper(items):
    ids = list({i["clipper_id"] for i in items})
    clippers = await db.clippers.find({"id": {"$in": ids}}, NO_ID).to_list(50)
    cmap = {c["id"]: c for c in clippers}
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
    return await db.clippers.find({}, NO_ID).to_list(100)

@api_router.get("/clippers/{clipper_id}")
async def get_clipper(clipper_id: str):
    c = await db.clippers.find_one({"id": clipper_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Clipper not found")
    return c

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
        "thumbnail": body.thumbnail or "https://images.pexels.com/photos/14540970/pexels-photo-14540970.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
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
    if not payments.is_configured():
        raise HTTPException(503, "Card payments are not configured on this server")
    try:
        url = payments.create_checkout_session(p)
    except Exception as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(502, "Could not start card checkout")
    return {"url": url, "test_mode": payments.is_test_mode()}


@api_router.post("/projects/{project_id}/checkout/confirm")
async def confirm_card_checkout(project_id: str, body: dict, user: dict = Depends(get_current_user)):
    await _require_project_owner(project_id, user)
    if not payments.is_configured():
        raise HTTPException(503, "Card payments are not configured on this server")
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

@api_router.post("/bids/{bid_id}/accept")
async def accept_bid(bid_id: str, user: dict = Depends(get_current_user)):
    bid = await db.bids.find_one({"id": bid_id}, NO_ID)
    if not bid:
        raise HTTPException(404, "Bid not found")
    await _require_project_owner(bid["project_id"], user)
    await db.bids.update_one({"id": bid_id}, {"$set": {"status": "accepted"}})
    contract = {
        "id": str(uuid.uuid4()), "project_id": bid["project_id"], "clipper_id": bid["clipper_id"],
        "price": bid["amount"], "bond": bid["bond_required"], "status": "awaiting_clipper",
        "started_at": None, "deadline_at": None, "versions": [], "payment_method": "usdc",
        "tx_hash": "5KJp" + uuid.uuid4().hex[:20] + "SoL", "rating_given": None,
    }
    await db.contracts.insert_one(dict(contract))
    await db.projects.update_one({"id": bid["project_id"]}, {"$set": {"status": "pending_acceptance"}})
    contract.pop("_id", None)
    return contract

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
    fee = round(c["price"] * 0.08, 2)
    return {"ok": True, "payout": round(c["price"] - fee, 2), "fee": fee, "bond_returned": c["bond"]}

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
    if user["role"] == "admin":
        return await db.brand_profiles.find({}, NO_ID).to_list(50)
    return await db.brand_profiles.find({"owner": user["id"]}, NO_ID).to_list(20)

@api_router.put("/brand-profiles/{profile_id}")
async def update_brand_profile(profile_id: str, body: BrandProfileUpdate, user: dict = Depends(get_current_user)):
    existing = await db.brand_profiles.find_one({"id": profile_id}, NO_ID)
    if existing and user["role"] != "admin" and existing.get("owner") != user["id"]:
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
    return {
        "stats": {
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

# ---------- AI Concierge ----------
CONCIERGE_SYSTEM = """You are the AI Clipping Concierge for Clip24, a marketplace where customers post short-form video clipping projects and trusted clippers deliver a first cut within 24 hours.

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

@api_router.post("/ai/chat")
async def ai_chat(body: ChatRequest, user: dict = Depends(require_role("customer", "admin"))):
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    except ImportError:
        raise HTTPException(503, "AI features are not configured (emergentintegrations not installed).")
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(503, "AI features require EMERGENT_LLM_KEY to be set in backend/.env.")
    history = await get_history(body.session_id)
    context = "\n".join(f"{m['sender']}: {m['text']}" for m in history[-12:])
    prompt = (f"Conversation so far:\n{context}\n\nCustomer: {body.message}" if context else body.message)
    await db.ai_messages.insert_one({"id": str(uuid.uuid4()), "session_id": body.session_id,
                                     "sender": "user", "text": body.message, "created_at": now_iso()})
    chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY"), session_id=body.session_id,
                   system_message=CONCIERGE_SYSTEM).with_model("openai", "gpt-5.4")

    async def gen():
        full = []
        try:
            async for ev in chat.stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full.append(ev.content)
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"AI stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
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
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except ImportError:
        raise HTTPException(503, "AI features are not configured (emergentintegrations not installed).")
    if not os.environ.get("EMERGENT_LLM_KEY"):
        raise HTTPException(503, "AI features require EMERGENT_LLM_KEY to be set in backend/.env.")
    history = await get_history(body.session_id)
    if not history:
        raise HTTPException(400, "No conversation found")
    convo = "\n".join(f"{m['sender']}: {m['text']}" for m in history)
    chat = LlmChat(api_key=os.environ.get("EMERGENT_LLM_KEY"), session_id=f"brief-{body.session_id}",
                   system_message=BRIEF_SYSTEM).with_model("openai", "gpt-5.4")
    resp = await chat.send_message(UserMessage(text=f"Conversation:\n{convo}\n\nGenerate the brief JSON."))
    text = resp.strip()
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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
