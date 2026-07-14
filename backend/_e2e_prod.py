"""Full end-to-end flow test against PRODUCTION. Reports pass/fail per flow.
Creates clearly-labeled test data and deletes it at the end."""
import requests, time, subprocess, sys

B = "https://24hourclipping.com/api"
SITE = "https://24hourclipping.com"
SFX = f"e2e-{int(time.time())}"
ok = 0; fail = 0; notes = []

def check(name, cond, detail=""):
    global ok, fail
    ok += bool(cond); fail += (not cond)
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + ("" if cond else f"  <- {detail}"))

def api(method, path, tok=None, expect=None, **kw):
    h = {"Authorization": f"Bearer {tok}"} if tok else {}
    r = requests.request(method, B + path, headers=h, timeout=20, **kw)
    return r

def psql(sql):
    return subprocess.run(["ssh", "-o", "ConnectTimeout=15", "ubuntu@10.8.0.2",
        f"cd /opt/24hourclipping && sudo docker compose -f docker-compose.prod.yml exec -T postgres psql -U clipping -d clipping -t -c \"{sql}\""],
        capture_output=True, text=True)

print("=== PUBLIC PAGES ===")
for p in ["/", "/marketplace", "/clippers", "/docs", "/login", "/register", "/privacy", "/terms"]:
    r = requests.get(SITE + p, timeout=15)
    check(f"page {p}", r.status_code == 200, r.status_code)
check("API root", requests.get(B + "/", timeout=15).json().get("status") == "live")

print("\n=== AUTH ===")
cr = api("POST", "/auth/register", json={"email": f"creator-{SFX}@example.com", "password": "password12345", "name": "Cora Creator"})
check("register creator", cr.status_code == 200, cr.text[:120]); ctok = cr.json().get("access_token")
check("creator has default avatar", bool(cr.json().get("user", {}).get("avatar")), "no avatar")
kr = api("POST", "/auth/register", json={"email": f"clipper-{SFX}@example.com", "password": "password12345", "name": "Kip Clipper", "role": "clipper"})
check("register clipper", kr.status_code == 200, kr.text[:120]); ktok0 = kr.json().get("access_token")
ob1 = api("POST", "/auth/onboarding", ctok, json={"roles": ["customer"]}); ctok = ob1.json().get("access_token") or ctok
check("onboard creator", ob1.status_code == 200, ob1.text[:120])
ob2 = api("POST", "/auth/onboarding", ktok0, json={"roles": ["clipper"], "specialties": ["Gaming"], "tools": ["CapCut"]}); ktok = ob2.json().get("access_token") or ktok0
check("onboard clipper", ob2.status_code == 200, ob2.text[:120])
check("creator /me", api("GET", "/auth/me", ctok).status_code == 200)
check("clipper /me roles", "clipper" in api("GET", "/auth/me", ktok).json().get("roles", []))
lg = api("POST", "/auth/login", json={"email": f"creator-{SFX}@example.com", "password": "password12345"})
check("login", lg.status_code == 200, lg.text[:120])

print("\n=== CREATE + FUND (Square) ===")
pr = api("POST", "/projects", ctok, json={"title": "E2E clutch clip", "category": "Gaming", "budget": 100,
     "references": ["https://x.com/a"], "quality_notes": "punchy", "allow_extension": True})
check("create project", pr.status_code == 200, pr.text[:150]); pid = pr.json().get("id")
co = api("POST", f"/projects/{pid}/checkout", ctok)
sq_url = co.json().get("url", "") if co.status_code == 200 else ""
check("Square checkout link", "square.link" in sq_url or "squareup" in sq_url, f"{co.status_code} {co.text[:120]}")
# open the project for the rest of the flow (real funding needs the hosted page)
psql(f"UPDATE projects SET status='open', funded=true WHERE id='{pid}';")

print("\n=== STORAGE (direct-to-S3) ===")
ps = api("POST", "/uploads/presign", ctok, json={"kind": "source", "filename": "t.mp4", "content_type": "video/mp4"})
check("presign upload", ps.status_code == 200 and "http" in ps.json().get("upload_url", ""), ps.text[:120])
if ps.status_code == 200:
    put = requests.put(ps.json()["upload_url"], data=b"e2e-bytes", headers={"Content-Type": "video/mp4"}, timeout=30)
    check("PUT direct to S3", put.status_code == 200, put.status_code)

print("\n=== BID + ACCEPT ===")
bd = api("POST", f"/projects/{pid}/bids", ktok, json={"amount": 90, "pitch": "I got you", "eta_hours": 12})
check("place bid", bd.status_code == 200, bd.text[:120]); bid = bd.json().get("id")
check("duplicate bid rejected", api("POST", f"/projects/{pid}/bids", ktok, json={"amount": 80, "pitch": "x", "eta_hours": 10}).status_code == 409)
check("owner reads bids", api("GET", f"/projects/{pid}/bids", ctok).status_code == 200)
check("bids need auth (IDOR closed)", api("GET", f"/projects/{pid}/bids").status_code == 401)
check("clipper /me/bids", any(b.get("id") == bid for b in api("GET", "/me/bids", ktok).json()))
ac = api("POST", f"/bids/{bid}/accept", ctok)
check("accept bid -> contract", ac.status_code == 200, ac.text[:120]); cid = ac.json().get("id")
check("double-accept idempotent", api("POST", f"/bids/{bid}/accept", ctok).status_code == 200)

print("\n=== CONTRACT + DELIVER + APPROVE ===")
check("creator sees contract", any(c.get("id") == cid for c in api("GET", "/contracts", ctok).json()))
check("clipper sees contract (capability scope)", any(c.get("id") == cid for c in api("GET", "/contracts", ktok).json()))
check("approve-before-deliver rejected", api("POST", f"/contracts/{cid}/approve", ctok, json={"rating": 5}).status_code == 409)
dl = api("POST", f"/contracts/{cid}/deliver", ktok, json={"note": "v1", "url": "http://v/1.mp4"})
check("clipper delivers", dl.status_code == 200, dl.text[:120])
ap = api("POST", f"/contracts/{cid}/approve", ctok, json={"rating": 5})
check("creator approves (credits balance)", ap.status_code == 200 and ap.json().get("credited"), ap.text[:120])
check("double-approve rejected", api("POST", f"/contracts/{cid}/approve", ctok, json={"rating": 5}).status_code == 409)
check("extend on completed rejected", api("POST", f"/contracts/{cid}/extend", ktok, json={"hours": 24}).status_code == 409)

print("\n=== CHAT ===")
check("contract msg send", api("POST", f"/contracts/{cid}/messages", ctok, json={"sender": "customer", "text": "hi"}).status_code == 200)
check("contract msg read", len(api("GET", f"/contracts/{cid}/messages", ktok).json()) >= 1)
check("bid msg send", api("POST", f"/bids/{bid}/messages", ktok, json={"text": "yo"}).status_code == 200)

print("\n=== PAYOUTS (PayPal) ===")
bal = api("GET", "/me/balance", ktok).json()
check("balance credited $82.80", abs(bal.get("available", 0) - 82.8) < 0.01, bal)
check("withdraw needs paypal email", api("POST", "/me/withdraw", ktok, json={"method": "paypal"}).status_code == 409)
check("set paypal email", api("POST", "/me/paypal-email", ktok, json={"email": f"kip-{SFX}@example.com"}).status_code == 200)
w = api("POST", "/me/withdraw", ktok, json={"method": "paypal"})
check("withdraw ok (queues, paypal not live)", w.status_code == 200, w.text[:120])
check("balance zero after withdraw", api("GET", "/me/balance", ktok).json().get("available") == 0)

print("\n=== ADMIN ===")
adm = api("POST", "/auth/login", json={"email": "bilalsaeedahmed1@gmail.com", "password": "PLACEHOLDER"})
if adm.status_code == 200:
    atok = adm.json().get("access_token")
    check("admin overview", api("GET", "/admin/overview", atok).status_code == 200)
    check("admin users", isinstance(api("GET", "/admin/users", atok).json(), list))
    check("admin set roles", api("POST", f"/admin/users/{cr.json()['user']['id']}/roles", atok, json={"roles": ["customer", "clipper"]}).status_code == 200)
else:
    notes.append("admin flows skipped (need admin password; set PLACEHOLDER)")
check("admin endpoints need admin (403/401 for non-admin)", api("GET", "/admin/overview", ctok).status_code in (401, 403))

print("\n=== CLEANUP ===")
r = psql(f"DELETE FROM users WHERE email LIKE '%{SFX}%';")
print("  cleanup:", "ok" if r.returncode == 0 else r.stderr[:100])

print(f"\n{'='*44}\nRESULT: {ok} passed, {fail} failed")
for n in notes: print("NOTE:", n)
sys.exit(1 if fail else 0)
