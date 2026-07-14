"""Card payments via Square (hosted Checkout / Payment Links — we never touch card data).

Flow mirrors the other providers: create a payment link -> redirect the creator to
Square's hosted checkout -> verify the order state on return.

Square is used for the PAY-IN side only (charging creators). Square has no
marketplace-payout product, so clipper payouts go out on a separate rail
(USDC/Solana today, PayPal Payouts later) — see docs/PAYMENTS.md.

Env:
  SQUARE_ACCESS_TOKEN   sandbox or production access token (Developer Dashboard)
  SQUARE_LOCATION_ID    a location id from the same account
  SQUARE_ENV            "sandbox" (default) | "production"
  SQUARE_CURRENCY       ISO currency, default USD
  SQUARE_API_VERSION    Square-Version header, default a recent stable version
Docs: https://developer.squareup.com/reference/square/checkout-api
"""
import os
import uuid
import requests

SQUARE_ACCESS_TOKEN = os.environ.get("SQUARE_ACCESS_TOKEN", "").strip()
SQUARE_LOCATION_ID = os.environ.get("SQUARE_LOCATION_ID", "").strip()
SQUARE_ENV = os.environ.get("SQUARE_ENV", "sandbox").strip().lower()
SQUARE_CURRENCY = os.environ.get("SQUARE_CURRENCY", "USD").upper()
SQUARE_API_VERSION = os.environ.get("SQUARE_API_VERSION", "2025-01-23")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://24hourclipping.com").rstrip("/")

_BASE = "https://connect.squareupsandbox.com" if SQUARE_ENV != "production" else "https://connect.squareup.com"


def is_configured() -> bool:
    return bool(SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID)


def is_sandbox() -> bool:
    return SQUARE_ENV != "production"


def _headers():
    return {
        "Authorization": f"Bearer {SQUARE_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "Square-Version": SQUARE_API_VERSION,
    }


def create_payment_intent(project: dict) -> dict:
    """Create a Square hosted-checkout payment link; returns {id, url}.

    `id` is the Square order_id, which we persist and later pass to get_status().
    """
    pid = project["id"]
    amount = int(round(float(project["budget"]) * 100))  # cents
    payload = {
        "idempotency_key": str(uuid.uuid4()),
        "quick_pay": {
            "name": (project.get("title") or "24 Hour Clipping project")[:255],
            "price_money": {"amount": amount, "currency": SQUARE_CURRENCY},
            "location_id": SQUARE_LOCATION_ID,
        },
        "checkout_options": {
            "redirect_url": f"{PUBLIC_BASE_URL}/customer/checkout/{pid}?paid=square",
            "ask_for_shipping_address": False,
        },
        "description": f"Funding for '{project.get('title', 'project')}' on 24 Hour Clipping",
    }
    r = requests.post(f"{_BASE}/v2/online-checkout/payment-links",
                      json=payload, headers=_headers(), timeout=20)
    r.raise_for_status()
    link = r.json()["payment_link"]
    return {"id": link.get("order_id"), "url": link.get("url"), "link_id": link.get("id")}


def get_status(order_id: str) -> str:
    """Return 'completed' once the hosted checkout is paid, else 'pending'.

    A paid Payment Link produces an Order whose state flips to COMPLETED (and which
    carries a tender). We treat COMPLETED as funded.
    """
    r = requests.get(f"{_BASE}/v2/orders/{order_id}", headers=_headers(), timeout=20)
    r.raise_for_status()
    order = r.json().get("order", {})
    state = (order.get("state") or "").upper()
    if state == "COMPLETED":
        return "completed"
    # Some flows mark the order OPEN but attach a completed tender/payment first.
    tenders = order.get("tenders") or []
    if tenders and all((t.get("card_details", {}).get("status", "CAPTURED") in ("CAPTURED", "AUTHORIZED")) for t in tenders):
        return "completed" if state in ("COMPLETED", "OPEN") and tenders else "pending"
    return "pending"
