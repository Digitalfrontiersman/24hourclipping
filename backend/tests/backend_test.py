"""
Backend API tests for 24 Hour Clipping.
Covers: seed data verification, full project flow (create->fund->bid->accept->activate->deliver->approve),
rescue/relaunch, messages, brand profile, admin overview, AI chat streaming, AI brief.
"""
import os
import json
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://clip-in.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ----- Seed data checks -----
class TestSeedData:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "live"

    def test_projects_open_seeded(self, client):
        r = client.get(f"{API}/projects", params={"status": "open"})
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 8, f"expected 8 open projects, got {len(data)}"
        assert all(p["status"] == "open" for p in data)
        # verify required fields
        p = data[0]
        for k in ("id", "title", "category", "budget", "bond", "thumbnail"):
            assert k in p

    def test_clippers_seeded(self, client):
        r = client.get(f"{API}/clippers")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 6
        c = data[0]
        for k in ("id", "name", "avatar", "specialty", "rating", "portfolio", "reviews"):
            assert k in c

    def test_contracts_seeded(self, client):
        r = client.get(f"{API}/contracts")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 7
        statuses = [c["status"] for c in data]
        assert statuses.count("live") == 3
        assert statuses.count("delivered") == 1
        assert statuses.count("rescue") == 1
        assert statuses.count("completed") == 2

    def test_admin_overview(self, client):
        r = client.get(f"{API}/admin/overview")
        assert r.status_code == 200
        d = r.json()
        assert "stats" in d
        s = d["stats"]
        for k in ("total_projects", "open_projects", "live_contracts", "rescue_mode",
                  "total_bids", "clippers", "fees_earned", "bonds_locked"):
            assert k in s
        assert s["clippers"] == 6
        assert s["live_contracts"] == 3
        assert s["rescue_mode"] == 1

    def test_get_specific_clipper(self, client):
        r = client.get(f"{API}/clippers/clipper-1")
        assert r.status_code == 200
        assert r.json()["id"] == "clipper-1"

    def test_get_specific_project(self, client):
        r = client.get(f"{API}/projects/project-1")
        assert r.status_code == 200
        assert r.json()["id"] == "project-1"

    def test_get_specific_contract(self, client):
        r = client.get(f"{API}/contracts/contract-1")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "contract-1"
        assert d["status"] == "live"
        assert d.get("clipper") is not None
        assert d.get("project") is not None

    def test_project_not_found(self, client):
        r = client.get(f"{API}/projects/nope-xyz")
        assert r.status_code == 404

    def test_bids_for_project(self, client):
        r = client.get(f"{API}/projects/project-1/bids")
        assert r.status_code == 200
        bids = r.json()
        assert isinstance(bids, list)
        # project-1 has seeded bids
        assert len(bids) >= 1
        assert bids[0].get("clipper") is not None

    def test_brand_profiles(self, client):
        r = client.get(f"{API}/brand-profiles")
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ----- Full flow -----
class TestFullFlow:
    _project_id = None
    _bid_id = None
    _contract_id = None

    def test_1_create_project(self, client):
        payload = {
            "title": "TEST_Flow Project",
            "category": "TikToks",
            "description": "Flow test",
            "budget": 100,
            "moment_mode": "known",
        }
        r = client.post(f"{API}/projects", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == "TEST_Flow Project"
        assert d["status"] == "draft"
        assert d["funded"] is False
        assert d["bond"] == 20.0  # 100*0.2
        TestFullFlow._project_id = d["id"]

        # Verify persistence
        g = client.get(f"{API}/projects/{d['id']}")
        assert g.status_code == 200
        assert g.json()["title"] == "TEST_Flow Project"

    def test_2_fund_project(self, client):
        pid = TestFullFlow._project_id
        assert pid
        r = client.post(f"{API}/projects/{pid}/fund", json={"payment_method": "usdc"})
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d.get("tx_hash", "").startswith("5KJp")
        # Verify
        g = client.get(f"{API}/projects/{pid}").json()
        assert g["funded"] is True
        assert g["status"] == "open"

    def test_3_create_bid(self, client):
        pid = TestFullFlow._project_id
        r = client.post(f"{API}/projects/{pid}/bids", json={
            "clipper_id": "clipper-1",
            "amount": 90,
            "pitch": "TEST_pitch here",
            "eta_hours": 12,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["amount"] == 90
        assert d["clipper"]["id"] == "clipper-1"
        TestFullFlow._bid_id = d["id"]

    def test_4_accept_bid(self, client):
        bid_id = TestFullFlow._bid_id
        assert bid_id
        r = client.post(f"{API}/bids/{bid_id}/accept")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "awaiting_clipper"
        assert d["clipper_id"] == "clipper-1"
        assert d["price"] == 90
        TestFullFlow._contract_id = d["id"]

    def test_5_activate_contract(self, client):
        cid = TestFullFlow._contract_id
        r = client.post(f"{API}/contracts/{cid}/activate")
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert "deadline_at" in d
        # Verify
        g = client.get(f"{API}/contracts/{cid}").json()
        assert g["status"] == "live"
        assert g["started_at"] is not None
        assert g["deadline_at"] is not None

    def test_6_post_message(self, client):
        cid = TestFullFlow._contract_id
        r = client.post(f"{API}/contracts/{cid}/messages",
                        json={"sender": "customer", "text": "TEST_hello clipper"})
        assert r.status_code == 200
        # Verify
        msgs = client.get(f"{API}/contracts/{cid}/messages").json()
        assert any(m["text"] == "TEST_hello clipper" for m in msgs)

    def test_7_deliver(self, client):
        cid = TestFullFlow._contract_id
        r = client.post(f"{API}/contracts/{cid}/deliver",
                        json={"note": "TEST_first cut", "url": ""})
        assert r.status_code == 200
        d = r.json()
        assert d["num"] == 1
        g = client.get(f"{API}/contracts/{cid}").json()
        assert g["status"] == "delivered"
        assert len(g["versions"]) == 1

    def test_8_revision(self, client):
        cid = TestFullFlow._contract_id
        r = client.post(f"{API}/contracts/{cid}/revision",
                        json={"sender": "customer", "text": "tighten hook"})
        assert r.status_code == 200
        g = client.get(f"{API}/contracts/{cid}").json()
        assert g["status"] == "revision"

    def test_9_second_deliver(self, client):
        cid = TestFullFlow._contract_id
        r = client.post(f"{API}/contracts/{cid}/deliver",
                        json={"note": "TEST_v2", "url": ""})
        assert r.status_code == 200
        assert r.json()["num"] == 2

    def test_a_approve(self, client):
        cid = TestFullFlow._contract_id
        r = client.post(f"{API}/contracts/{cid}/approve", json={"rating": 5})
        assert r.status_code == 200
        d = r.json()
        # 8% fee: 90 -> fee 7.20, payout 82.80
        assert d["fee"] == 7.20
        assert d["payout"] == 82.80
        assert "bond_returned" in d
        g = client.get(f"{API}/contracts/{cid}").json()
        assert g["status"] == "completed"
        assert g["rating_given"] == 5


# ----- Rescue/relaunch flow (uses seeded rescue contract-5) -----
class TestRescueFlow:
    def test_rescue_relaunch_on_new_contract(self, client):
        # Create fresh project + bid + contract to test rescue without touching seeded contract-5
        p = client.post(f"{API}/projects", json={
            "title": "TEST_Rescue", "category": "TikToks", "budget": 60}).json()
        client.post(f"{API}/projects/{p['id']}/fund", json={"payment_method": "usdc"})
        b = client.post(f"{API}/projects/{p['id']}/bids", json={
            "clipper_id": "clipper-2", "amount": 60, "pitch": "x", "eta_hours": 20}).json()
        c = client.post(f"{API}/bids/{b['id']}/accept").json()
        client.post(f"{API}/contracts/{c['id']}/activate")

        r = client.post(f"{API}/contracts/{c['id']}/rescue")
        assert r.status_code == 200
        d = r.json()
        assert d["refund"] == 60

        g = client.get(f"{API}/contracts/{c['id']}").json()
        assert g["status"] == "rescue"

        r2 = client.post(f"{API}/contracts/{c['id']}/relaunch")
        assert r2.status_code == 200

        g2 = client.get(f"{API}/contracts/{c['id']}").json()
        assert g2["status"] == "closed_rescued"
        p2 = client.get(f"{API}/projects/{p['id']}").json()
        assert p2["status"] == "open"
        assert p2.get("priority") is True


# ----- Brand profile update -----
class TestBrandProfile:
    def test_upsert(self, client):
        r = client.put(f"{API}/brand-profiles/brand-1", json={
            "name": "TEST_Brand", "description": "d", "audience": "a",
            "caption_style": "bold", "pacing": "fast", "cta": "sub", "avoid": "", "fonts": ""
        })
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Brand"


# ----- 404s -----
class TestErrors:
    def test_bad_activate(self, client):
        r = client.post(f"{API}/contracts/bogus-xyz/activate")
        assert r.status_code == 404

    def test_bad_accept_bid(self, client):
        r = client.post(f"{API}/bids/bogus-xyz/accept")
        assert r.status_code == 404

    def test_bad_fund(self, client):
        r = client.post(f"{API}/projects/bogus-xyz/fund", json={"payment_method": "usdc"})
        assert r.status_code == 404


# ----- AI (budget: 1 chat call + 1 brief call = 2 calls total) -----
class TestAI:
    def test_ai_chat_stream(self, client):
        sid = f"TEST_sess_{uuid.uuid4().hex[:8]}"
        r = client.post(f"{API}/ai/chat",
                        json={"session_id": sid, "message": "I want to clip a 90s podcast highlight for TikTok, budget $80"},
                        stream=True, timeout=90)
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        deltas = []
        got_done = False
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("data: "):
                payload = line[6:]
                if payload == "[DONE]":
                    got_done = True
                    break
                try:
                    j = json.loads(payload)
                    if "delta" in j:
                        deltas.append(j["delta"])
                    elif "error" in j:
                        pytest.fail(f"AI stream error: {j['error']}")
                except json.JSONDecodeError:
                    pass
        assert got_done, "stream did not send [DONE]"
        joined = "".join(deltas)
        assert len(joined) > 5, "empty AI response"
        # verify persisted
        h = client.get(f"{API}/ai/history/{sid}").json()
        assert len(h) >= 2  # user + ai
        TestAI._sid = sid

    def test_ai_brief(self, client):
        sid = getattr(TestAI, "_sid", None)
        if not sid:
            pytest.skip("No chat session")
        # Add one more turn so brief has enough context
        r0 = client.post(f"{API}/ai/chat",
                         json={"session_id": sid, "message": "Audience is 20-35 startup founders, mood insightful, bold captions, CTA follow"},
                         stream=True, timeout=90)
        # consume
        for line in r0.iter_lines():
            if line and line.decode().startswith("data: [DONE]"):
                break

        r = client.post(f"{API}/ai/brief", json={"session_id": sid}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("title", "category", "budget", "bond"):
            assert k in d
        assert 20 <= d["budget"] <= 500
        assert d["bond"] > 0
