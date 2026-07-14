"""Clipper payouts via PayPal Payouts API (send money to a PayPal email).

Square handles pay-in (charging creators); PayPal handles pay-out (paying clippers),
since Square has no third-party payout product. Clippers withdraw their balance to
their PayPal email.

Env:
  PAYPAL_CLIENT_ID   REST app client id (Developer Dashboard)
  PAYPAL_SECRET      REST app secret
  PAYPAL_ENV         "sandbox" (default) | "production"
  PAYPAL_CURRENCY    ISO currency, default USD
Docs: https://developer.paypal.com/docs/api/payments.payouts-batch/v1/
"""
import os
import uuid
import requests

PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "").strip()
PAYPAL_SECRET = os.environ.get("PAYPAL_SECRET", "").strip()
PAYPAL_ENV = os.environ.get("PAYPAL_ENV", "sandbox").strip().lower()
PAYPAL_CURRENCY = os.environ.get("PAYPAL_CURRENCY", "USD").upper()

_BASE = "https://api-m.sandbox.paypal.com" if PAYPAL_ENV != "production" else "https://api-m.paypal.com"


class PaymentError(Exception):
    pass


def is_configured() -> bool:
    return bool(PAYPAL_CLIENT_ID and PAYPAL_SECRET)


def is_sandbox() -> bool:
    return PAYPAL_ENV != "production"


def _access_token() -> str:
    r = requests.post(f"{_BASE}/v1/oauth2/token",
                      auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
                      data={"grant_type": "client_credentials"},
                      headers={"Accept": "application/json"}, timeout=20)
    if r.status_code >= 300:
        raise PaymentError(f"PayPal auth failed: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


def send_payout(email: str, amount: float, note: str = "24 Hour Clipping earnings") -> dict:
    """Send a single payout to a PayPal email. Returns {batch_id, status}."""
    if not is_configured():
        raise PaymentError("PayPal is not configured")
    token = _access_token()
    body = {
        "sender_batch_header": {
            "sender_batch_id": uuid.uuid4().hex,
            "email_subject": "You've been paid on 24 Hour Clipping",
            "email_message": note,
        },
        "items": [{
            "recipient_type": "EMAIL",
            "amount": {"value": f"{float(amount):.2f}", "currency": PAYPAL_CURRENCY},
            "receiver": email,
            "note": note,
            "sender_item_id": uuid.uuid4().hex,
        }],
    }
    r = requests.post(f"{_BASE}/v1/payments/payouts", json=body,
                      headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                      timeout=25)
    if r.status_code >= 300:
        raise PaymentError(f"PayPal payout failed: {r.status_code} {r.text[:300]}")
    header = r.json().get("batch_header", {})
    return {"batch_id": header.get("payout_batch_id"), "status": header.get("batch_status")}
