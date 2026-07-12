"""Network School (NS) showcase — hardcoded real-traction data.

Idempotent: run on every startup (and re-applied after demo resets). Creates 4
NS clipper accounts ($20 credit each), their public profiles, the NS job as the
top marketplace listing, and 4 bids from those clippers.
"""
from datetime import datetime, timedelta, timezone
import auth

def _iso(dt):
    return dt.isoformat()

def _bond(b):
    if b < 50:
        return 5.0
    if b < 100:
        return round(b * 0.15, 2)
    return round(b * 0.20, 2)

NS_PASSWORD = "NSclipper2026"
NS_THUMB = "/showcase/NS-thumb.jpg"
NS_CLIP1 = "/showcase/clip1.mp4"
NS_CLIP2 = "/showcase/clip2.mp4"

# id, name, email, handle, specialty, rating, on_time, jobs, price, badge, avatar#, delivered_clip_url
NS_CLIPPERS = [
    ("ns-clipper-1", "Kai Nakamura", "kai@ns.school", "@kaiclips", "Stream Highlights & Gaming", 5.0, 100, 148, "$40-$120", "NS Founding Clipper", 14, NS_CLIP1),
    ("ns-clipper-2", "Priya Sharma", "priya@ns.school", "@priyaedits", "Podcast & Talking-Head", 4.9, 99, 121, "$50-$160", "NS Verified", 22, NS_CLIP2),
    ("ns-clipper-3", "Marco Silva", "marco@ns.school", "@marcoreels", "Short Ads & Reels", 4.9, 98, 96, "$60-$200", "NS Verified", 8, None),
    ("ns-clipper-4", "Zara Ahmed", "zara@ns.school", "@zaracuts", "TikTok & Shorts", 5.0, 100, 203, "$35-$110", "NS Founding Clipper", 47, None),
]

NS_BIDS = [
    ("ns-clipper-1", 110, "NS member — I actually cut this footage. Hook lands in 1.5s.", 8),
    ("ns-clipper-2", 125, "Founder storytelling is my lane. Emotional arc guaranteed.", 12),
    ("ns-clipper-3", 118, "Ad-grade motion graphics + captions, delivered early.", 10),
    ("ns-clipper-4", 100, "300+ shorts shipped. This one will pop off.", 6),
]


async def seed_ns(db):
    t = datetime.now(timezone.utc)
    pw_hash = auth.hash_password(NS_PASSWORD)

    for i, (cid, name, email, handle, spec, rating, ontime, jobs, price, badge, av, clip_url) in enumerate(NS_CLIPPERS):
        avatar = f"https://i.pravatar.cc/150?img={av}"
        await db.users.update_one({"id": cid}, {"$set": {
            "id": cid, "email": email, "name": name, "role": "clipper", "credits": 20,
            "hashed_password": pw_hash, "auth_provider": "local", "disabled": False,
            "avatar": avatar, "from_ns": True,
        }, "$setOnInsert": {"created_at": _iso(t)}}, upsert=True)
        await db.clippers.update_one({"id": cid}, {"$set": {
            "id": cid, "name": name, "avatar": avatar, "specialty": spec, "handle": handle,
            "rating": rating, "on_time_pct": ontime, "completed_jobs": jobs, "price_range": price,
            "badge": badge, "missed_deadlines": 0, "repeat_clients": 20 + i * 9,
            "ratings": {"editing": rating, "brief_match": rating, "communication": rating},
            "earnings": 20, "bond_balance": 40, "tools": ["Premiere Pro", "CapCut", "After Effects"],
            "portfolio": [{"title": f"{name} — clip for Network School", "thumb": NS_THUMB,
                           "video_url": clip_url or NS_THUMB}],
            "delivered_clip": clip_url,
            "reviews": [{"author": "Network School", "rating": 5, "text": "Shipped a scroll-stopping cut fast."}],
            "status": "approved", "from_ns": True,
        }}, upsert=True)

    # The NS job — pinned to the top of the marketplace (newest posted_at).
    await db.projects.update_one({"id": "ns-showcase"}, {"$set": {
        "id": "ns-showcase", "title": "NS — 24 Hour Clipping", "category": "Short Ads",
        "description": "Real gig from Network School: turn our founder footage into scroll-stopping short-form clips. Hook in the first 2 seconds, bold captions, delivered within 24 hours.",
        "budget": 120, "thumbnail": NS_THUMB, "posted_at": _iso(t + timedelta(minutes=5)),
        "bids_count": len(NS_BIDS), "source_length": "1h 20m", "output_length": "30-60s",
        "aspect_ratio": "9:16", "captions": "Bold captions", "bond": _bond(120), "status": "open",
        "customer_name": "Network School", "timestamp_provided": True, "moment_mode": "known",
        "platform": "TikTok", "source_link": "https://drive.google.com/drive/folders/NS",
        "owner_id": "demo-customer", "funded": True, "goal": "Showcase real NS traction",
        "audience": "Founders & builders", "mood": "Premium", "style": "Fast cuts, punch-ins",
        "cta": "Join Network School", "is_ns_showcase": True,
    }}, upsert=True)

    await db.bids.delete_many({"project_id": "ns-showcase"})
    bids = []
    for j, (cid, amt, pitch, eta) in enumerate(NS_BIDS):
        bids.append({"id": f"ns-bid-{j+1}", "project_id": "ns-showcase", "clipper_id": cid,
                     "amount": amt, "pitch": pitch, "eta_hours": eta, "bond_required": _bond(amt),
                     "status": "pending", "created_at": _iso(t - timedelta(minutes=20 - j * 4))})
    await db.bids.insert_many(bids)
