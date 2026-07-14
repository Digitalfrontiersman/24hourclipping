"""Card payments via Stripe Checkout (hosted - we never touch card data).

Demo-friendly flow: create a Checkout Session, redirect the customer to Stripe's
hosted page, and confirm payment on return by retrieving the session (no webhook
setup required). For production you'd also add a webhook for reliability.
"""
import os

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "").strip()
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "https://clip42.duckdns.org").rstrip("/")

_stripe = None
if STRIPE_SECRET_KEY:
    import stripe as _stripe_lib
    _stripe_lib.api_key = STRIPE_SECRET_KEY
    _stripe = _stripe_lib


def is_configured() -> bool:
    return _stripe is not None


def is_test_mode() -> bool:
    return STRIPE_SECRET_KEY.startswith("sk_test_")


def create_checkout_session(project: dict) -> str:
    """Return the hosted Checkout URL for funding a project."""
    pid = project["id"]
    session = _stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": f"24 Hour Clipping project: {project.get('title', 'Project')}"},
                "unit_amount": int(round(float(project["budget"]) * 100)),
            },
            "quantity": 1,
        }],
        success_url=f"{PUBLIC_BASE_URL}/customer/checkout/{pid}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{PUBLIC_BASE_URL}/customer/checkout/{pid}?canceled=1",
        client_reference_id=pid,
        metadata={"project_id": pid},
    )
    return session.url


def session_is_paid(session_id: str, project_id: str) -> bool:
    """Verify a returned Checkout session actually paid for this project."""
    session = _stripe.checkout.Session.retrieve(session_id)
    return (
        session.get("payment_status") == "paid"
        and session.get("metadata", {}).get("project_id") == project_id
    )
