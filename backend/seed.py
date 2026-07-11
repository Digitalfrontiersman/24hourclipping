import uuid
from datetime import datetime, timedelta, timezone

def now():
    return datetime.now(timezone.utc)

def iso(dt):
    return dt.isoformat()

def bond_for(budget: float) -> float:
    if budget < 50:
        return 5.0
    if budget < 100:
        return round(budget * 0.15, 2)
    return round(budget * 0.20, 2)

IMG = {
    "studio": "https://images.pexels.com/photos/14540970/pexels-photo-14540970.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
    "editor1": "https://images.pexels.com/photos/8100060/pexels-photo-8100060.jpeg?auto=compress&cs=tinysrgb&w=800",
    "editor2": "https://images.pexels.com/photos/8102680/pexels-photo-8102680.jpeg?auto=compress&cs=tinysrgb&w=800",
    "snow": "https://images.unsplash.com/photo-1478700485868-972b69dc3fc4?w=800&q=80",
    "moto": "https://images.unsplash.com/photo-1445605081472-9788fb3bc02f?w=800&q=80",
    "kite": "https://images.pexels.com/photos/10089230/pexels-photo-10089230.jpeg?auto=compress&cs=tinysrgb&w=800",
}
VIDS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
]
AVATARS = [f"https://i.pravatar.cc/150?img={n}" for n in (12, 32, 5, 68, 47, 15)]

CLIPPER_IDS = [f"clipper-{i+1}" for i in range(6)]

def build_clippers():
    data = [
        ("Maya Torres", "Stream Highlights", 4.9, 100, 214, "$40-$120", "Founding Clipper"),
        ("Devon Reeves", "Podcast Clips", 4.8, 98, 167, "$50-$150", "Verified"),
        ("Lena Okafor", "TikTok & Reels", 5.0, 100, 302, "$35-$90", "Founding Clipper"),
        ("Jonah Park", "Talking-Head & Founder Clips", 4.7, 96, 88, "$60-$200", "Verified"),
        ("Sasha Ivanov", "Short Ads", 4.9, 99, 143, "$80-$250", "Founding Clipper"),
        ("Rio Almeida", "YouTube Shorts", 4.8, 97, 121, "$30-$100", "Verified"),
    ]
    clippers = []
    for i, (name, spec, rating, ontime, jobs, price, badge) in enumerate(data):
        clippers.append({
            "id": CLIPPER_IDS[i],
            "name": name,
            "avatar": AVATARS[i],
            "specialty": spec,
            "rating": rating,
            "on_time_pct": ontime,
            "completed_jobs": jobs,
            "price_range": price,
            "badge": badge,
            "missed_deadlines": 0 if ontime == 100 else (1 if ontime >= 98 else 3),
            "repeat_clients": 18 + i * 7,
            "ratings": {"editing": round(rating - 0.1, 1), "brief_match": rating, "communication": round(min(5.0, rating + 0.1), 1)},
            "earnings": 4200 + i * 1850,
            "bond_balance": 120 + i * 40,
            "tools": ["Premiere Pro", "CapCut", "After Effects"][: (i % 3) + 1],
            "portfolio": [
                {"title": f"{spec} — Sample {n+1}", "thumb": list(IMG.values())[(i + n) % 6], "video_url": VIDS[(i + n) % 4]}
                for n in range(3)
            ],
            "reviews": [
                {"author": "StreamerJay", "rating": 5, "text": "First cut in 14 hours. Nailed the hook."},
                {"author": "PodLab Media", "rating": rating, "text": "Understood the brief instantly. Zero friction."},
            ],
            "status": "approved",
        })
    return clippers

def build_projects(t):
    defs = [
        ("Ranked Grand Finals Clutch Moment", "Stream Highlights", 85, IMG["snow"], "2h 14m", "30-60s", "9:16", "Bold captions", True, 6, "Twitch VOD", 3),
        ("Podcast: Why Founders Burn Out", "Podcast Clips", 120, IMG["studio"], "1h 42m", "45-90s", "9:16", "Clean subtitles", False, 4, "YouTube link", 7),
        ("Product Launch Teaser Ad", "Short Ads", 250, IMG["moto"], "18m", "15-30s", "1:1", "Branded captions", True, 8, "Google Drive", 1),
        ("Founder Story: Bootstrapping to $1M", "Talking-Head", 95, IMG["editor2"], "38m", "60-90s", "9:16", "Karaoke style", False, 5, "Dropbox", 5),
        ("IRL Stream Fail Compilation", "Stream Highlights", 45, IMG["kite"], "3h 05m", "20-45s", "9:16", "Meme captions", True, 9, "Twitch VOD", 2),
        ("Fitness Coach Reels Pack", "Reels", 150, IMG["editor1"], "55m", "15-30s", "4:5", "Minimal captions", False, 3, "Instagram", 9),
        ("SaaS Demo YouTube Short", "YouTube Shorts", 75, IMG["moto"], "22m", "30-60s", "9:16", "Clean subtitles", True, 2, "YouTube link", 4),
        ("Comedy Podcast Best Bits", "TikToks", 60, IMG["studio"], "2h 30m", "30-60s", "9:16", "Bold captions", False, 7, "Spotify + video", 6),
    ]
    projects = []
    for i, (title, cat, budget, thumb, src, out, ar, cap, ts, bids, source, hrs) in enumerate(defs):
        projects.append({
            "id": f"project-{i+1}",
            "title": title,
            "category": cat,
            "description": f"Looking for a punchy {out} cut. Hook viewers in the first 2 seconds. {cap} preferred.",
            "budget": budget,
            "thumbnail": thumb,
            "posted_at": iso(t - timedelta(hours=hrs)),
            "bids_count": bids,
            "source_length": src,
            "output_length": out,
            "aspect_ratio": ar,
            "captions": cap,
            "bond": bond_for(budget),
            "status": "open",
            "customer_name": ["NovaStreams", "The Deep Work Pod", "Velocity Labs", "Aria Chen", "TurboTed", "FitWithMara", "Cloudbase", "LateNight Laughs"][i],
            "timestamp_provided": ts,
            "moment_mode": "known" if ts else "find",
            "platform": ["TikTok", "YouTube Shorts", "Instagram Reels", "TikTok", "TikTok", "Instagram Reels", "YouTube Shorts", "TikTok"][i],
            "source_link": source,
            "funded": i % 2 == 0,
            "goal": "Grow audience and drive follows",
            "audience": "18-34 short-form viewers",
            "mood": ["Hype", "Insightful", "Premium", "Authentic", "Chaotic-fun", "Motivating", "Crisp", "Comedic"][i],
            "style": "Fast cuts, punch-ins, sound design",
            "cta": "Follow for more",
        })
    return projects

def build_bids(t):
    bids = []
    pool = [
        ("project-1", 0, 78, "I clip ranked clutches daily — hook in 1.5s guaranteed.", 10),
        ("project-1", 2, 70, "300+ gaming clips shipped. I'll make this pop.", 8),
        ("project-1", 5, 82, "Clean pacing + kill-feed zooms. My specialty.", 12),
        ("project-2", 1, 110, "Podcast storytelling is my lane. Emotional arc guaranteed.", 14),
        ("project-2", 3, 118, "I'll find the burnout money-quote and build around it.", 12),
        ("project-3", 4, 240, "Ad-grade motion graphics included in this price.", 16),
        ("project-4", 3, 90, "Founder clips are 80% of my portfolio.", 10),
        ("project-5", 0, 40, "Fail comps are my bread and butter. Meme captions on point.", 6),
    ]
    for i, (pid, ci, amount, pitch, eta) in enumerate(pool):
        bids.append({
            "id": f"bid-{i+1}",
            "project_id": pid,
            "clipper_id": CLIPPER_IDS[ci],
            "amount": amount,
            "pitch": pitch,
            "eta_hours": eta,
            "bond_required": bond_for(amount),
            "status": "pending",
            "created_at": iso(t - timedelta(minutes=30 + i * 11)),
        })
    return bids

def build_contracts(t):
    defs = [
        ("contract-1", "project-c1", "Esports Tournament Recap", "Stream Highlights", 0, 95, 18.5, "live", IMG["snow"]),
        ("contract-2", "project-c2", "CEO Keynote Highlight", "Talking-Head", 3, 140, 9.2, "live", IMG["editor2"]),
        ("contract-3", "project-c3", "Coffee Brand 15s Ad", "Short Ads", 4, 220, 3.1, "live", IMG["moto"]),
        ("contract-4", "project-c4", "True Crime Pod Teaser", "Podcast Clips", 1, 88, 21.7, "delivered", IMG["studio"]),
        ("contract-5", "project-c5", "Gaming Marathon Best-Of", "Stream Highlights", 2, 65, -2.0, "rescue", IMG["kite"]),
        ("contract-6", "project-c6", "Startup Pitch Reel", "Talking-Head", 3, 130, 0, "completed", IMG["editor1"]),
        ("contract-7", "project-c7", "Sneaker Drop TikTok", "TikToks", 2, 90, 0, "completed", IMG["moto"]),
    ]
    projects, contracts = [], []
    for cid, pid, title, cat, ci, price, hrs_left, status, thumb in defs:
        started = t - timedelta(hours=24 - hrs_left) if hrs_left else t - timedelta(days=3)
        deadline = started + timedelta(hours=24)
        pstatus = {"live": "contract_live", "delivered": "delivered", "rescue": "rescue", "completed": "completed"}[status]
        projects.append({
            "id": pid, "title": title, "category": cat,
            "description": "Locked brief. Deliver a scroll-stopping first cut.",
            "budget": price, "thumbnail": thumb, "posted_at": iso(started - timedelta(hours=5)),
            "bids_count": 5, "source_length": "1h 10m", "output_length": "30-60s",
            "aspect_ratio": "9:16", "captions": "Bold captions", "bond": bond_for(price),
            "status": pstatus, "customer_name": "Demo Customer", "timestamp_provided": True,
            "moment_mode": "known", "platform": "TikTok", "source_link": "Google Drive",
            "funded": True, "goal": "Maximize reach", "audience": "18-34", "mood": "Hype",
            "style": "Fast cuts", "cta": "Follow for more",
        })
        versions = []
        if status in ("delivered", "completed"):
            versions = [{"num": 1, "url": VIDS[0], "thumb": thumb, "note": "First cut — tightened the hook per brief.", "submitted_at": iso(t - timedelta(hours=2))}]
        if status == "completed":
            versions.append({"num": 2, "url": VIDS[1], "thumb": thumb, "note": "Final — revised captions + end card.", "submitted_at": iso(t - timedelta(hours=1))})
        contracts.append({
            "id": cid, "project_id": pid, "clipper_id": CLIPPER_IDS[ci],
            "price": price, "bond": bond_for(price), "status": status,
            "started_at": iso(started), "deadline_at": iso(deadline),
            "versions": versions, "payment_method": "usdc",
            "tx_hash": "5KJp" + uuid.uuid4().hex[:20] + "SoL",
            "rating_given": 5 if status == "completed" else None,
        })
    return projects, contracts

def build_messages(t):
    msgs = []
    convo = [
        ("customer", "Footage link is in the brief — the clutch moment is at 1:42:10."),
        ("clipper", "Got it. Downloading now. I'll punch in on the final kill and add kill-feed zoom."),
        ("customer", "Perfect. Keep the caption style bold like my last clip."),
        ("clipper", "On it. First cut coming well before the deadline."),
    ]
    for i, (sender, text) in enumerate(convo):
        msgs.append({"id": str(uuid.uuid4()), "contract_id": "contract-1", "sender": sender, "text": text,
                     "created_at": iso(t - timedelta(hours=4 - i))})
    return msgs

async def seed_db(db):
    t = now()
    await db.clippers.delete_many({})
    await db.projects.delete_many({})
    await db.bids.delete_many({})
    await db.contracts.delete_many({})
    await db.messages.delete_many({})
    await db.brand_profiles.delete_many({})
    await db.clippers.insert_many(build_clippers())
    open_projects = build_projects(t)
    contract_projects, contracts = build_contracts(t)
    await db.projects.insert_many(open_projects + contract_projects)
    await db.bids.insert_many(build_bids(t))
    await db.contracts.insert_many(contracts)
    await db.messages.insert_many(build_messages(t))
    await db.brand_profiles.insert_one({
        "id": "brand-1", "owner": "demo-customer", "name": "NovaStreams",
        "description": "Variety streamer, 120k followers. High-energy gaming and IRL.",
        "audience": "16-30 gamers", "colors": ["#CCFF00", "#0A0A0A"], "fonts": "Manrope, bold",
        "caption_style": "Bold, all-caps hooks", "pacing": "Fast, 1.5s max shot length",
        "cta": "Follow @NovaStreams", "avoid": "Slow intros, watermark clutter, cringe zooms",
        "logo": None, "reference_clips": [VIDS[2]],
    })
