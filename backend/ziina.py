"""Card / Apple Pay payments via Ziina (hosted checkout — we never touch card data).

Flow: create a payment intent -> redirect the customer to Ziina's hosted page
(cards, Apple Pay, Google Pay) -> verify the intent status on return.
Docs: https://docs.ziina.com/api-reference/payment-intent
"""
import os
import requests

ZIINA_API_KEY = os.environ.get("ZIINA_API_KEY", "").strip()
ZIINA_TEST = os.environ.get("ZIINA_TEST", "true").lower() == "true"
ZIINA_CURRENCY = os.environ.get("ZIINA_CURRENCY", "AED").upper()
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://clip42.duckdns.org").rstrip("/")

API_BASE = "https://api-v2.ziina.com/api/payment_intent"


def is_configured() -> bool:
    return bool(ZIINA_API_KEY)


def _headers():
    return {"Authorization": f"Bearer {ZIINA_API_KEY}", "Content-Type": "application/json"}


def create_payment_intent(project: dict) -> dict:
    """Create a Ziina payment intent; returns {id, url}."""
    pid = project["id"]
    amount = int(round(float(project["budget"]) * 100))  # base units (e.g. fils/cents)
    payload = {
        "amount": amount,
        "currency_code": ZIINA_CURRENCY,
        "message": f"24 Hour Clipping project: {project.get('title', 'Project')}",
        "success_url": f"{PUBLIC_BASE_URL}/customer/checkout/{pid}?paid=ziina",
        "cancel_url": f"{PUBLIC_BASE_URL}/customer/checkout/{pid}?canceled=1",
        "failure_url": f"{PUBLIC_BASE_URL}/customer/checkout/{pid}?failed=1",
        "test": ZIINA_TEST,
    }
    r = requests.post(API_BASE, json=payload, headers=_headers(), timeout=20)
    r.raise_for_status()
    data = r.json()
    return {"id": data["id"], "url": data.get("redirect_url") or data.get("embedded_url")}


def get_status(payment_intent_id: str) -> str:
    r = requests.get(f"{API_BASE}/{payment_intent_id}", headers=_headers(), timeout=20)
    r.raise_for_status()
    return r.json().get("status", "")
