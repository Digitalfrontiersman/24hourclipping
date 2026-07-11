from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from seed import seed_db, bond_for

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
    clipper_id: str
    amount: float
    pitch: str
    eta_hours: int

class MessageCreate(BaseModel):
    sender: str
    text: str

class DeliveryCreate(BaseModel):
    note: str = ""
    url: str = ""

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
async def reset_demo():
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
async def get_projects(status: Optional[str] = None, category: Optional[str] = None):
    q = {}
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    return await db.projects.find(q, NO_ID).sort("posted_at", -1).to_list(200)

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str):
    p = await db.projects.find_one({"id": project_id}, NO_ID)
    if not p:
        raise HTTPException(404, "Project not found")
    return p

@api_router.post("/projects")
async def create_project(body: ProjectCreate):
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
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
async def fund_project(project_id: str, body: FundRequest):
    tx = "5KJp" + uuid.uuid4().hex[:20] + "SoL" if body.payment_method == "usdc" else None
    r = await db.projects.update_one({"id": project_id}, {"$set": {"funded": True, "status": "open", "payment_method": body.payment_method, "tx_hash": tx}})
    if not r.matched_count:
        raise HTTPException(404, "Project not found")
    return {"ok": True, "tx_hash": tx}

@api_router.get("/projects/{project_id}/bids")
async def get_bids(project_id: str):
    bids = await db.bids.find({"project_id": project_id}, NO_ID).sort("created_at", -1).to_list(100)
    return await attach_clipper(bids)

@api_router.post("/projects/{project_id}/bids")
async def create_bid(project_id: str, body: BidCreate):
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()), "project_id": project_id,
        "bond_required": bond_for(body.amount), "status": "pending", "created_at": now_iso(),
    })
    await db.bids.insert_one(dict(doc))
    await db.projects.update_one({"id": project_id}, {"$inc": {"bids_count": 1}})
    doc.pop("_id", None)
    return (await attach_clipper([doc]))[0]

@api_router.post("/bids/{bid_id}/accept")
async def accept_bid(bid_id: str):
    bid = await db.bids.find_one({"id": bid_id}, NO_ID)
    if not bid:
        raise HTTPException(404, "Bid not found")
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
async def get_contracts(status: Optional[str] = None):
    q = {"status": status} if status else {}
    contracts = await db.contracts.find(q, NO_ID).to_list(100)
    contracts = await attach_clipper(contracts)
    pids = list({c["project_id"] for c in contracts})
    projects = await db.projects.find({"id": {"$in": pids}}, NO_ID).to_list(100)
    pmap = {p["id"]: p for p in projects}
    for c in contracts:
        c["project"] = pmap.get(c["project_id"])
    return contracts

@api_router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str):
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    c = (await attach_clipper([c]))[0]
    c["project"] = await db.projects.find_one({"id": c["project_id"]}, NO_ID)
    return c

@api_router.post("/contracts/{contract_id}/activate")
async def activate_contract(contract_id: str):
    started = datetime.now(timezone.utc)
    deadline = started + timedelta(hours=24)
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    await db.contracts.update_one({"id": contract_id}, {"$set": {
        "status": "live", "started_at": started.isoformat(), "deadline_at": deadline.isoformat()}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "contract_live"}})
    return {"ok": True, "deadline_at": deadline.isoformat()}

@api_router.post("/contracts/{contract_id}/deliver")
async def deliver(contract_id: str, body: DeliveryCreate):
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    version = {
        "num": len(c.get("versions", [])) + 1,
        "url": body.url or "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "thumb": None, "note": body.note or "First cut submitted.", "submitted_at": now_iso(),
    }
    await db.contracts.update_one({"id": contract_id}, {"$push": {"versions": version}, "$set": {"status": "delivered"}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "delivered"}})
    return version

@api_router.post("/contracts/{contract_id}/revision")
async def request_revision(contract_id: str, body: MessageCreate):
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "revision"}})
    await db.messages.insert_one({"id": str(uuid.uuid4()), "contract_id": contract_id,
                                  "sender": "customer", "text": f"REVISION REQUEST: {body.text}", "created_at": now_iso()})
    return {"ok": True}

@api_router.post("/contracts/{contract_id}/approve")
async def approve(contract_id: str, body: RateRequest):
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "completed", "rating_given": body.rating}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "completed"}})
    fee = round(c["price"] * 0.08, 2)
    return {"ok": True, "payout": round(c["price"] - fee, 2), "fee": fee, "bond_returned": c["bond"]}

@api_router.post("/contracts/{contract_id}/rescue")
async def trigger_rescue(contract_id: str):
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "rescue"}})
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "rescue"}})
    return {"ok": True, "refund": c["price"], "bond_credit": c["bond"]}

@api_router.post("/contracts/{contract_id}/relaunch")
async def relaunch(contract_id: str):
    c = await db.contracts.find_one({"id": contract_id}, NO_ID)
    if not c:
        raise HTTPException(404, "Contract not found")
    await db.projects.update_one({"id": c["project_id"]}, {"$set": {"status": "open", "posted_at": now_iso(), "priority": True}})
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "closed_rescued"}})
    return {"ok": True}

@api_router.get("/contracts/{contract_id}/messages")
async def get_messages(contract_id: str):
    return await db.messages.find({"contract_id": contract_id}, NO_ID).sort("created_at", 1).to_list(200)

@api_router.post("/contracts/{contract_id}/messages")
async def post_message(contract_id: str, body: MessageCreate):
    doc = {"id": str(uuid.uuid4()), "contract_id": contract_id, "sender": body.sender,
           "text": body.text, "created_at": now_iso()}
    await db.messages.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.get("/brand-profiles")
async def get_brand_profiles():
    return await db.brand_profiles.find({}, NO_ID).to_list(20)

@api_router.put("/brand-profiles/{profile_id}")
async def update_brand_profile(profile_id: str, body: BrandProfileUpdate):
    await db.brand_profiles.update_one({"id": profile_id}, {"$set": body.model_dump()}, upsert=True)
    return await db.brand_profiles.find_one({"id": profile_id}, NO_ID)

@api_router.get("/admin/overview")
async def admin_overview():
    projects = await db.projects.find({}, NO_ID).to_list(300)
    contracts = await db.contracts.find({}, NO_ID).to_list(300)
    contracts = await attach_clipper(contracts)
    pmap = {p["id"]: p for p in projects}
    for c in contracts:
        c["project"] = pmap.get(c["project_id"])
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

@api_router.post("/ai/chat")
async def ai_chat(body: ChatRequest):
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
async def ai_history(session_id: str):
    return await get_history(session_id)

@api_router.post("/ai/brief")
async def ai_brief(body: BriefRequest):
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    if await db.clippers.count_documents({}) == 0:
        await seed_db(db)
        logger.info("Seeded demo data")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
