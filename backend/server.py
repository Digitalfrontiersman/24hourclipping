from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import re
import json
import asyncio
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta, timezone

from collections import defaultdict

from sqlalchemy import select, update, delete, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import auth
import blog
import storage
import payments
import square
import paypal
import solana_pay as solpay

from database import get_session, init_db, SessionLocal, engine
from models import (
    User, UserRoleAssoc, ClipperProfile, PortfolioItem, BrandProfile,
    Project, ProjectReference, Bid, Contract, Delivery, Review, Message,
    Transaction, Withdrawal, AppSetting, BlogPost,
    AuthProvider, UserRole, ProjectStatus, BidStatus, ContractStatus,
    Currency, TxnKind, TxnStatus, WithdrawalStatus,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def as_uuid(val):
    """Parse a value into a UUID, returning None on anything invalid (so a bad path
    param surfaces as a clean 404 rather than a 500)."""
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return None


def client_ip(request) -> str:
    """Real client IP behind nginx (X-Forwarded-For), for per-user rate limiting."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def bond_for(budget: float) -> float:
    """Deadline bond a clipper stakes, as a function of the project budget."""
    budget = float(budget)
    if budget < 50:
        return 5.0
    if budget < 100:
        return round(budget * 0.15, 2)
    return round(budget * 0.20, 2)


def _dec(currency: str) -> int:
    return {"sol": 9, "usd": 2}.get(currency, 6)


def _base_units(amount, currency: str) -> int:
    return int(round(float(amount) * (10 ** _dec(currency))))


# ---- Email (SMTP e.g. Gmail app password, or Resend) ----
def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email. Prefers SMTP (works to any recipient with no
    domain - e.g. a Gmail App Password); falls back to Resend. No-op if unset."""
    if not to:
        return False
    sender = os.environ.get("EMAIL_FROM", "24 Hour Clipping <onboarding@resend.dev>")

    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    if smtp_host:
        import smtplib
        from email.mime.text import MIMEText
        from email.utils import parseaddr
        try:
            user = os.environ.get("SMTP_USER", "").strip()
            pw = os.environ.get("SMTP_PASS", "")
            port = int(os.environ.get("SMTP_PORT", "587"))
            msg = MIMEText(html, "html", "utf-8")
            msg["Subject"] = subject
            msg["From"] = sender or user
            msg["To"] = to
            server = smtplib.SMTP(smtp_host, port, timeout=20)
            server.starttls()
            if user:
                server.login(user, pw)
            server.sendmail(parseaddr(sender)[1] or user, [to], msg.as_string())
            server.quit()
            logger.info("Email sent (SMTP) to %s (%s)", to, subject)
            return True
        except Exception as e:
            logger.error("SMTP email error: %s", e)
            return False

    key = os.environ.get("RESEND_API_KEY", "").strip()
    if not key:
        return False
    import requests
    try:
        r = requests.post("https://api.resend.com/emails",
                          headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                          json={"from": sender, "to": [to], "subject": subject, "html": html}, timeout=15)
        if r.status_code >= 300:
            logger.error("Resend email failed %s: %s", r.status_code, r.text[:300])
            return False
        logger.info("Email sent to %s (%s)", to, subject)
        return True
    except Exception as e:
        logger.error("Resend email error: %s", e)
        return False


def _email_base_url() -> str:
    return os.environ.get("PUBLIC_BASE_URL", "https://24hourclipping.com").rstrip("/")


def _email_shell(*, preheader: str, eyebrow: str, headline: str, body_html: str,
                 cta_label: str, cta_href: str, highlights=None, extra_html: str = "",
                 footer_note: str = "") -> str:
    """Responsive, client-safe transactional email built on nested tables with
    inline styles and a bulletproof button, so it renders in Gmail, Apple Mail,
    and Outlook alike. Content is passed in; the branded shell stays consistent.
    `highlights` is an optional list of (title, description) rendered as numbered steps."""
    base = _email_base_url()
    footer_note = footer_note or ("This is an automated message from a send-only address, "
                                  "so please do not reply to it.")
    font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
    highlights_html = ""
    if highlights:
        rows = ""
        for i, (t, d) in enumerate(highlights, 1):
            rows += (
                '<tr>'
                '<td valign="top" style="padding:0 16px 18px 0;width:34px;">'
                f'<div style="width:28px;height:28px;border-radius:999px;background:#0A0A0A;color:#CCFF00;'
                f'font-family:{font};font-weight:800;font-size:13px;line-height:28px;text-align:center;">{i}</div>'
                '</td>'
                f'<td valign="top" style="padding:0 0 18px 0;font-family:{font};">'
                f'<div style="color:#111827;font-size:15px;font-weight:700;line-height:1.4;">{t}</div>'
                f'<div style="color:#6b7280;font-size:14px;line-height:1.6;margin-top:3px;">{d}</div>'
                '</td></tr>'
            )
        highlights_html = (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 4px;">'
            '<tr><td colspan="2" style="border-top:1px solid #eceef1;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>'
            '<tr><td colspan="2" style="height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr>'
            f'{rows}</table>'
        )
    return f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>24 Hour Clipping</title>
  <!--[if mso]><style>.btn{{padding:0 !important;}}</style><![endif]-->
  <style>
    body{{margin:0;padding:0;background:#eef0f4;}}
    a{{text-decoration:none;}}
    @media only screen and (max-width:600px){{
      .container{{width:100% !important;}}
      .px{{padding-left:26px !important;padding-right:26px !important;}}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background:#eef0f4;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef0f4;font-size:1px;line-height:1px;">{preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f4;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
          <!-- Logo lockup: hosted PNG mark (survives SVG-stripping) + HTML
               wordmark (survives image-blocking) -->
          <tr>
            <td align="center" style="padding:2px 40px 28px;font-family:{font};">
              <img src="{base}/email-logo.png" width="38" height="38" alt="24 Hour Clipping" style="vertical-align:middle;border:0;outline:none;display:inline-block;">
              <span style="font-size:19px;font-weight:800;letter-spacing:-0.5px;color:#111827;vertical-align:middle;padding-left:11px;">24HR CLIPPING</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td class="px" style="background:#ffffff;border:1px solid #e6e8ec;border-top:3px solid #CCFF00;border-radius:16px;padding:42px 44px 40px;font-family:{font};box-shadow:0 8px 24px -12px rgba(16,24,40,0.12);">
              <span style="display:inline-block;background:#0A0A0A;color:#CCFF00;font-size:11px;letter-spacing:1.5px;font-weight:800;text-transform:uppercase;padding:5px 12px;border-radius:999px;">{eyebrow}</span>
              <h1 style="margin:18px 0 14px;font-size:26px;line-height:1.25;color:#111827;font-weight:800;letter-spacing:-0.5px;">{headline}</h1>
              <div style="color:#4b5563;font-size:16px;line-height:1.65;">{body_html}</div>
              {extra_html}
              {highlights_html}
              <!-- Bulletproof button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 6px;">
                <tr><td align="left">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{cta_href}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="50%" fillcolor="#CCFF00" stroke="f">
                    <center style="color:#0A0A0A;font-family:{font};font-size:15px;font-weight:bold;">{cta_label}</center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <a class="btn" href="{cta_href}" style="display:inline-block;background:#CCFF00;color:#0A0A0A;font-family:{font};font-size:15px;font-weight:800;line-height:50px;text-align:center;padding:0 40px;border-radius:999px;">{cta_label} &rarr;</a>
                  <!--<![endif]-->
                </td></tr>
              </table>
              <p style="margin:22px 0 0;color:#9ca3af;font-size:13px;line-height:1.6;">Or copy this link into your browser:<br><a href="{cta_href}" style="color:#6b7280;word-break:break-all;">{cta_href}</a></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="px" style="padding:26px 44px;font-family:{font};">
              <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;line-height:1.6;">
                <a href="{base}/docs" style="color:#6b7280;font-weight:600;">Docs</a> &nbsp;&bull;&nbsp;
                <a href="{base}/terms" style="color:#6b7280;font-weight:600;">Terms</a> &nbsp;&bull;&nbsp;
                <a href="{base}/privacy" style="color:#6b7280;font-weight:600;">Privacy</a>
              </p>
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                24 Hour Clipping - short-form clips, made in 24 hours.<br>
                {footer_note}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _acceptance_email_html(name: str, title: str, amount, deadline_iso: str) -> str:
    base = _email_base_url()
    body = (f"A creator just picked you to clip <b style=\"color:#ffffff;\">&ldquo;{title}&rdquo;</b>. "
            "Your deal is live and the 24-hour clock has started. Head to your dashboard to grab the "
            "footage and ship your first cut before it hits zero.")
    extra = (
        "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" "
        "style=\"margin:22px 0 4px;background:#0A0A0A;border:1px solid #262626;border-radius:14px;\">"
        "<tr><td style=\"padding:16px 18px;font-family:Arial,Helvetica,sans-serif;\">"
        "<div style=\"color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;\">Payout on approval</div>"
        f"<div style=\"color:#CCFF00;font-size:24px;font-weight:800;margin-top:4px;\">${amount}</div>"
        "</td></tr></table>"
    )
    return _email_shell(
        preheader=f"You're hired to clip “{title}” - the 24-hour clock has started.",
        eyebrow="You're hired", headline=f"Nice one {name}, your bid was accepted.",
        body_html=body, extra_html=extra,
        cta_label="Open your dashboard", cta_href=f"{base}/clipper",
        footer_note="Deliver before the clock hits zero to protect your bond and your streak.",
    )


def _welcome_email_html(name: str, role_hint: str) -> str:
    """First-touch email sent the moment someone signs up. Sent no-reply."""
    base = _email_base_url()
    if role_hint == "clipper":
        eyebrow, headline = "You're in", f"Welcome, {name}."
        body = ("You're one step from your first paid clip. Here's how you start earning on "
                "24 Hour Clipping:")
        cta_label, cta_href = "Find a job to clip", f"{base}/onboarding"
        preheader = "Finish your profile and place your first bid in one tap."
        highlights = [
            ("Finish your profile", "Add your specialties, tools, and a couple of sample clips so creators can find you."),
            ("Bid on open jobs", "Browse live briefs and place a one-tap bid. Your price and ETA are prefilled."),
            ("Deliver and get paid", "Win the job, ship your cut before the clock hits zero, and get paid on approval."),
        ]
    else:
        eyebrow, headline = "Welcome aboard", f"Welcome, {name}."
        body = ("You're ready to get scroll-stopping clips made fast. Here's how it works on "
                "24 Hour Clipping:")
        cta_label, cta_href = "Post your first clip", f"{base}/onboarding"
        preheader = "Post a clip and get a finished cut in under 24 hours."
        highlights = [
            ("Post your clip", "Describe the moment, set a budget, and upload or link your footage."),
            ("Clippers bid in minutes", "Vetted editors compete for your job, each staking a bond behind the deadline."),
            ("Get your cut in 24 hours", "Pick your clipper, review the cut, and approve to release payment."),
        ]
    return _email_shell(
        preheader=preheader, eyebrow=eyebrow, headline=headline, body_html=body,
        cta_label=cta_label, cta_href=cta_href, highlights=highlights,
    )


def _verification_email_html(name: str, verify_url: str) -> str:
    """Sent to new email/password signups to confirm their address before the
    account is usable."""
    body = ("Welcome to 24 Hour Clipping. Confirm this email address to activate your "
            "account and get started. For your security, this link expires in 24 hours.")
    return _email_shell(
        preheader="Confirm your email to activate your 24 Hour Clipping account.",
        eyebrow="Verify your email", headline=f"Confirm your email, {name}.",
        body_html=body,
        cta_label="Verify my email", cta_href=verify_url,
        footer_note="If you didn't create this account, you can safely ignore this email.",
    )


# ============================ REQUEST MODELS ============================
class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    category: str = Field(max_length=60)
    description: str = Field(default="", max_length=4000)
    budget: float = Field(gt=0, le=100000)
    source_link: str = ""
    source_key: Optional[str] = None
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
    thumbnail_key: Optional[str] = None
    customer_name: str = "Demo Customer"
    references: List[str] = Field(default_factory=list)
    quality_notes: str = Field(default="", max_length=2000)


class AdminProjectUpdate(BaseModel):
    """All fields optional; only provided ones are applied (admin project edit)."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=140)
    category: Optional[str] = Field(default=None, max_length=60)
    description: Optional[str] = Field(default=None, max_length=4000)
    budget: Optional[float] = Field(default=None, gt=0, le=100000)
    output_length: Optional[str] = None
    aspect_ratio: Optional[str] = None
    captions: Optional[str] = None
    platform: Optional[str] = None
    moment_mode: Optional[str] = None
    goal: Optional[str] = None
    audience: Optional[str] = None
    mood: Optional[str] = None
    style: Optional[str] = None
    cta: Optional[str] = None
    source_link: Optional[str] = None
    quality_notes: Optional[str] = Field(default=None, max_length=2000)
    deadline_hours: Optional[int] = Field(default=None, ge=1, le=168)
    allow_extension: Optional[bool] = None
    deadline_hours: int = Field(default=24, ge=1, le=168)
    allow_extension: bool = False

class BidCreate(BaseModel):
    clipper_id: Optional[str] = None
    amount: float = Field(gt=0, le=100000)
    pitch: str = Field(min_length=1, max_length=500)
    eta_hours: int = Field(gt=0, le=72)

class MessageCreate(BaseModel):
    sender: Optional[str] = None
    text: str

class DeliveryCreate(BaseModel):
    note: str = ""
    url: str = ""
    key: Optional[str] = None

class SolanaFundRequest(BaseModel):
    signature: str
    currency: str = "usdc"

class PayoutWalletRequest(BaseModel):
    wallet: str

class PayoutEmailRequest(BaseModel):
    email: str

class WithdrawRequest(BaseModel):
    method: str = "paypal"               # "paypal" (default) | "usdc" (Solana)
    destination: Optional[str] = None    # paypal email / wallet address; defaults to the saved one

class TipRequest(BaseModel):
    signature: str
    amount: float
    currency: str = "usdc"

class RateRequest(BaseModel):
    rating: int = 5

class ExtendRequest(BaseModel):
    hours: int = Field(gt=0, le=48)

class BrandProfileUpdate(BaseModel):
    name: str = ""
    description: str = ""
    audience: str = ""
    caption_style: str = ""
    pacing: str = ""
    cta: str = ""
    avoid: str = ""
    fonts: str = ""
    colors: List[str] = Field(default_factory=list)

class ChatRequest(BaseModel):
    session_id: str
    message: str

class BriefRequest(BaseModel):
    session_id: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(min_length=1, max_length=80)
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str
    role: Optional[str] = None

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class SwitchRoleRequest(BaseModel):
    role: str

class OnboardingRequest(BaseModel):
    roles: List[str] = []
    active_role: Optional[str] = None
    brand_name: str = ""
    niche: str = ""
    content_type: str = ""
    platforms: str = ""
    audience: str = ""
    specialties: List[str] = []
    tools: List[str] = []
    samples: List[str] = []
    payout_wallet: str = ""


class ClipperProfileUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    price_range: Optional[str] = None
    tools: Optional[List[str]] = None
    bio: Optional[str] = None
    avatar_key: Optional[str] = None
    avatar_url: Optional[str] = None


# ============================ AUTH / IDENTITY HELPERS ============================
ROLE_ORDER = ["customer", "clipper", "admin"]
bearer_scheme = HTTPBearer(auto_error=False)


def _roles_list(user_row: User) -> list:
    """Order-normalised capability list. Only call on a User loaded with
    selectinload(User.roles) - accessing the relationship lazily is not
    allowed under async SQLAlchemy."""
    held = {r.role.value for r in (user_row.roles or [])}
    return [r for r in ROLE_ORDER if r in held]


def _order_roles(role_values) -> list:
    held = set(role_values)
    return [r for r in ROLE_ORDER if r in held]


async def _load_role_values(session: AsyncSession, user_id) -> set:
    """Async-safe read of a user's capabilities straight from the join table."""
    return set(await session.scalars(
        select(UserRoleAssoc.role).where(UserRoleAssoc.user_id == user_id)))


def _user_to_dict(user_row: User, active_role: Optional[str] = None,
                  roles: Optional[list] = None) -> dict:
    """Mirror the legacy Mongo user document shape so `user_roles`, `public_user`,
    `require_role`, and every endpoint keep working unchanged. The active `role`
    lives only in the JWT now (there is no active-role column); we thread it in.
    `roles` MUST be supplied unless `user_row` was loaded with selectinload(User.roles)."""
    if roles is None:
        roles = _roles_list(user_row)
    if active_role:
        active = active_role
    elif roles:
        active = roles[0]
    else:
        active = "customer"
    return {
        "id": str(user_row.id),
        "email": user_row.email,
        "name": user_row.name,
        "role": active,
        "roles": roles,
        "onboarded": bool(user_row.onboarded),
        "credits": user_row.credits,
        "avatar": user_row.avatar_url,
        "payout_wallet": user_row.payout_wallet,
        "hashed_password": user_row.hashed_password,
        "auth_provider": user_row.auth_provider.value if user_row.auth_provider else "local",
        "disabled": bool(user_row.disabled),
        "created_at": user_row.created_at.isoformat() if user_row.created_at else None,
    }


def user_roles(u: dict) -> list:
    """Capabilities the account holds. An explicit empty list means "registered but
    not yet onboarded" - no capabilities."""
    roles = u.get("roles")
    if roles is None:
        return [u["role"]] if u.get("role") else []
    return roles


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u.get("email"), "name": u.get("name"),
            "role": u.get("role"), "roles": user_roles(u), "onboarded": bool(u.get("onboarded", True)),
            "credits": u.get("credits", 0), "avatar": u.get("avatar"),
            "payout_wallet": u.get("payout_wallet")}


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
                           session: AsyncSession = Depends(get_session)) -> dict:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = auth.decode_access_token(creds.credentials)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    uid = as_uuid(payload.get("sub"))
    row = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.id == uid)) if uid else None
    if not row or row.disabled:
        raise HTTPException(401, "User not found")
    return _user_to_dict(row, active_role=payload.get("role"))


async def get_current_user_optional(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
                                    session: AsyncSession = Depends(get_session)):
    if not creds:
        return None
    try:
        payload = auth.decode_access_token(creds.credentials)
        uid = as_uuid(payload.get("sub"))
        row = await session.scalar(
            select(User).options(selectinload(User.roles)).where(User.id == uid)) if uid else None
        if not row or row.disabled:
            return None
        return _user_to_dict(row, active_role=payload.get("role"))
    except Exception:
        return None


def require_role(*roles):
    """Capability-based gate: the account must hold at least one of `roles`
    (admin always passes)."""
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        held = set(user_roles(user))
        if "admin" in held or held & set(roles):
            return user
        raise HTTPException(403, "Insufficient permissions")
    return dep


async def _require_project_owner(session: AsyncSession, project_id: str, user: dict) -> Project:
    pid = as_uuid(project_id)
    p = await session.get(Project, pid) if pid else None
    if not p:
        raise HTTPException(404, "Project not found")
    if "admin" not in user_roles(user) and str(p.owner_id) != user["id"]:
        raise HTTPException(403, "You do not own this project")
    return p


async def _require_contract_party(session: AsyncSession, contract_id: str, user: dict,
                                  allow=("customer", "clipper")) -> Contract:
    cid = as_uuid(contract_id)
    c = await session.get(Contract, cid) if cid else None
    if not c:
        raise HTTPException(404, "Contract not found")
    if "admin" in user_roles(user):
        return c
    proj = await session.get(Project, c.project_id)
    is_customer = proj is not None and str(proj.owner_id) == user["id"]
    is_clipper = str(c.clipper_id) == user["id"]
    if ("customer" in allow and is_customer) or ("clipper" in allow and is_clipper):
        return c
    raise HTTPException(403, "You are not a party to this contract")


async def _issue(user: dict) -> dict:
    token = auth.create_access_token(user["id"], user.get("role") or "customer")
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


async def _ensure_clipper_profile_row(session: AsyncSession, user_row: User) -> ClipperProfile:
    existing = await session.get(ClipperProfile, user_row.id)
    if existing:
        return existing
    prof = ClipperProfile(
        user_id=user_row.id, specialty="New Clipper", tools=[], rating=0,
        on_time_pct=100, completed_jobs=0, missed_deadlines=0, status="approved",
        price_min=20, price_max=100, badge="New",
    )
    session.add(prof)
    await session.flush()
    return prof


async def _ensure_roles(session: AsyncSession, user_id, roles) -> set:
    """Add any missing role assocs for the user (async-safe: queries the join
    table directly rather than touching the User.roles relationship). Returns the
    full set of role enums the user holds after the call."""
    have = await _load_role_values(session, user_id)
    for r in roles:
        er = UserRole(r)
        if er not in have:
            session.add(UserRoleAssoc(user_id=user_id, role=er))
            have.add(er)
    return have


# ============================ SERIALIZERS ============================
def _parse_price_range(s):
    nums = re.findall(r"\d+(?:\.\d+)?", s or "")
    if len(nums) >= 2:
        return float(nums[0]), float(nums[1])
    if len(nums) == 1:
        return float(nums[0]), float(nums[0])
    return None, None


def _price_range_str(prof: ClipperProfile) -> str:
    if prof.price_min is not None and prof.price_max is not None:
        return f"${int(prof.price_min)}-${int(prof.price_max)}"
    return "$20-$100"


def clipper_public(profile: Optional[ClipperProfile], user: Optional[User]) -> Optional[dict]:
    if not profile:
        return None
    uid = str(profile.user_id)
    return {
        "id": uid,
        "name": user.name if user else "",
        "avatar": (user.avatar_url if user else None) or _default_avatar(user.name if user else "clipper"),
        "specialty": profile.specialty or "New Clipper",
        "rating": float(profile.rating or 0),
        "on_time_pct": profile.on_time_pct,
        "completed_jobs": profile.completed_jobs,
        "price_range": _price_range_str(profile),
        "badge": profile.badge or "New",
        "missed_deadlines": profile.missed_deadlines,
        "repeat_clients": 0,
        "ratings": {"editing": 0, "brief_match": 0, "communication": 0},
        "earnings": 0,
        "bond_balance": 0,
        "tools": list(profile.tools or []),
        "portfolio": [
            {"title": p.title, "thumb": p.thumb_url, "video_url": p.video_url, "url": p.video_url}
            for p in sorted(profile.portfolio or [], key=lambda x: x.position)
        ],
        "reviews": [],
        "status": profile.status,
        "bio": profile.bio or "",
        "payout_wallet": user.payout_wallet if user else None,
    }


def project_public(p: Project, customer_name: Optional[str] = None, bids_count: int = 0) -> dict:
    return {
        "id": str(p.id),
        "owner_id": str(p.owner_id),
        "title": p.title,
        "category": p.category,
        "description": p.description or "",
        "budget": float(p.budget),
        "bond": float(p.bond or 0),
        "status": p.status.value,
        "funded": bool(p.funded),
        "hidden": bool(p.hidden),
        "official": bool(p.official),
        "output_length": p.output_length,
        "aspect_ratio": p.aspect_ratio,
        "captions": p.captions,
        "platform": p.platform,
        "moment_mode": p.moment_mode,
        "goal": p.goal,
        "audience": p.audience,
        "mood": p.mood,
        "style": p.style,
        "cta": p.cta,
        "source_link": p.source_link,
        "source_key": p.source_key,
        "source_length": p.source_length,
        "quality_notes": p.quality_notes,
        "deadline_hours": p.deadline_hours,
        "allow_extension": bool(p.allow_extension),
        "payment_method": p.payment_method,
        "references": [r.url for r in sorted(p.references or [], key=lambda r: r.position)],
        "thumbnail": p.thumbnail_url,
        "customer_name": customer_name,
        "bids_count": bids_count or 0,
        "timestamp_provided": p.moment_mode == "known",
        "posted_at": p.created_at.isoformat() if p.created_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def bid_public(b: Bid) -> dict:
    return {
        "id": str(b.id),
        "project_id": str(b.project_id),
        "clipper_id": str(b.clipper_id),
        "amount": float(b.amount),
        "pitch": b.pitch,
        "eta_hours": b.eta_hours,
        "bond_required": float(b.bond_required or 0),
        "status": b.status.value,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


def _version_json(d: Delivery) -> dict:
    return {
        "num": d.version,
        "key": d.object_key,
        "url": storage.sign_media_url(d.object_key) if d.object_key else d.url,
        "thumb": d.thumb_url,
        "note": d.note,
        "submitted_at": d.submitted_at.isoformat() if d.submitted_at else None,
    }


def contract_public(c: Contract, deliveries: Optional[list] = None) -> dict:
    """Serialize a contract. `deliveries` is passed in explicitly (batch-loaded by
    the caller) so we never lazy-load the relationship under async."""
    return {
        "id": str(c.id),
        "bid_id": str(c.bid_id),
        "project_id": str(c.project_id),
        "clipper_id": str(c.clipper_id),
        "price": float(c.price),
        "bond": float(c.bond or 0),
        "status": c.status.value,
        "base_hours": c.base_hours,
        "extended_hours": c.extended_hours,
        "allow_extension": bool(c.allow_extension),
        "started_at": c.started_at.isoformat() if c.started_at else None,
        "deadline_at": c.deadline_at.isoformat() if c.deadline_at else None,
        "rating_given": c.rating_given,
        "payment_method": c.payment_method,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "versions": [_version_json(d) for d in sorted(deliveries or [], key=lambda d: d.version)],
    }


def message_public(m: Message, sender_name: Optional[str] = None) -> dict:
    d = {
        "id": str(m.id),
        "sender": m.sender_role.value,
        "sender_name": sender_name,
        "text": m.text,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
    if m.contract_id:
        d["contract_id"] = str(m.contract_id)
    if m.bid_id:
        d["bid_id"] = str(m.bid_id)
    return d


def brand_public(bp: BrandProfile) -> dict:
    return {
        "id": str(bp.id),
        "owner": str(bp.owner_id),
        "owner_id": str(bp.owner_id),
        "name": bp.name,
        "description": bp.description,
        "audience": bp.audience,
        "caption_style": bp.caption_style,
        "pacing": bp.pacing,
        "cta": bp.cta,
        "avoid": bp.avoid,
        "fonts": bp.fonts,
        "colors": list(bp.colors or []),
    }


def _admin_user_json(u: User) -> dict:
    roles = _roles_list(u)
    return {
        "id": str(u.id),
        "email": u.email,
        "name": u.name,
        "role": roles[0] if roles else None,
        "roles": roles,
        "onboarded": bool(u.onboarded),
        "credits": u.credits,
        "disabled": bool(u.disabled),
        "avatar": u.avatar_url,
        "auth_provider": u.auth_provider.value if u.auth_provider else "local",
        "payout_wallet": u.payout_wallet,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ---- batch enrichment ----
async def attach_clipper(session: AsyncSession, items: list) -> list:
    ids = {as_uuid(i["clipper_id"]) for i in items if i.get("clipper_id")}
    ids.discard(None)
    if not ids:
        for i in items:
            i["clipper"] = None
        return items
    profs = {p.user_id: p for p in await session.scalars(
        select(ClipperProfile).options(selectinload(ClipperProfile.portfolio))
        .where(ClipperProfile.user_id.in_(ids)))}
    users = {u.id: u for u in await session.scalars(
        select(User).where(User.id.in_(ids)))}
    for i in items:
        cid = as_uuid(i.get("clipper_id"))
        i["clipper"] = clipper_public(profs.get(cid), users.get(cid))
    return items


async def serialize_projects(session: AsyncSession, projects: list) -> list:
    if not projects:
        return []
    owner_ids = {p.owner_id for p in projects}
    pids = [p.id for p in projects]
    names = dict((await session.execute(
        select(User.id, User.name).where(User.id.in_(owner_ids)))).all())
    counts = dict((await session.execute(
        select(Bid.project_id, func.count()).where(Bid.project_id.in_(pids)).group_by(Bid.project_id))).all())
    return [project_public(p, names.get(p.owner_id), counts.get(p.id, 0)) for p in projects]


async def serialize_project(session: AsyncSession, p: Project) -> dict:
    name = await session.scalar(select(User.name).where(User.id == p.owner_id))
    cnt = await session.scalar(select(func.count()).select_from(Bid).where(Bid.project_id == p.id))
    return project_public(p, name, cnt or 0)


async def _attach_payouts(session: AsyncSession, contracts_json: list) -> None:
    ids = {as_uuid(c["id"]) for c in contracts_json}
    ids.discard(None)
    if not ids:
        return
    txns = await session.scalars(select(Transaction).where(
        Transaction.kind == TxnKind.payout, Transaction.contract_id.in_(ids)))
    m = {t.contract_id: t for t in txns}
    for c in contracts_json:
        t = m.get(as_uuid(c["id"]))
        if t:
            meta = t.meta or {}
            c["payout_sig"] = t.chain_sig
            c["payout_currency"] = t.currency.value
            c["payout_amount"] = meta.get("clipper")
            c["fee_amount"] = meta.get("fee")
            c["payout_wallet"] = meta.get("wallet")
            c["payout_at"] = meta.get("at")


async def enrich_contracts(session: AsyncSession, rows: list) -> list:
    cids = [c.id for c in rows]
    # Batch-load deliveries by contract (never lazy-load off the passed rows,
    # which may be freshly created or fetched via session.get).
    dmap = defaultdict(list)
    if cids:
        for d in await session.scalars(select(Delivery).where(Delivery.contract_id.in_(cids))):
            dmap[d.contract_id].append(d)
    data = [contract_public(c, dmap.get(c.id, [])) for c in rows]
    await attach_clipper(session, data)
    pids = {c.project_id for c in rows}
    proj_rows = list(await session.scalars(
        select(Project).options(selectinload(Project.references))
        .where(Project.id.in_(pids)))) if pids else []
    serialized = await serialize_projects(session, proj_rows)
    pmap = {as_uuid(pj["id"]): pj for pj in serialized}
    for d in data:
        d["project"] = pmap.get(as_uuid(d["project_id"]))
    await _attach_payouts(session, data)
    return data


async def serialize_messages(session: AsyncSession, rows: list) -> list:
    sender_ids = {m.sender_id for m in rows}
    names = {}
    if sender_ids:
        names = dict((await session.execute(
            select(User.id, User.name).where(User.id.in_(sender_ids)))).all())
    return [message_public(m, names.get(m.sender_id)) for m in rows]


# ---- settings (K/V used for payment intents + AI concierge history) ----
async def _get_setting(session: AsyncSession, key: str):
    s = await session.get(AppSetting, key)
    return s.value if s else None


async def _set_setting(session: AsyncSession, key: str, value: dict):
    s = await session.get(AppSetting, key)
    if s:
        s.value = value
    else:
        session.add(AppSetting(key=key, value=value))


# ============================ STARTUP HELPERS ============================
async def ensure_auth_setup():
    """Ensure the real admin account exists in Postgres. No demo users, no seeding."""
    admin_email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "")
    if not (admin_email and admin_pw):
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD not set - no real admin account provisioned.")
        return
    async with SessionLocal() as session:
        row = await session.scalar(select(User).where(User.email == admin_email))
        if row:
            row.hashed_password = auth.hash_password(admin_pw)
            row.onboarded = True
            row.disabled = False
        else:
            row = User(email=admin_email, name="Administrator",
                       hashed_password=auth.hash_password(admin_pw),
                       auth_provider=AuthProvider.local, onboarded=True, credits=0)
            session.add(row)
            await session.flush()
        await _ensure_roles(session, row.id, ["customer", "clipper", "admin"])
        if not row.avatar_url:
            row.avatar_url = _default_avatar(row.name)
        await session.commit()
        logger.info("Admin account ensured for %s", admin_email)
        # Backfill/refresh default avatars: any account with no avatar, or still on
        # an older generated-default style, gets the current neat style. Real
        # (uploaded / Google) avatars are left untouched.
        blanks = (await session.scalars(select(User).where(or_(
            User.avatar_url.is_(None),
            User.avatar_url.like("%dicebear.com/9.x/initials%"),
            User.avatar_url.like("%dicebear.com/9.x/notionists%"))))).all()
        for u in blanks:
            u.avatar_url = _default_avatar(u.name)
        if blanks:
            await session.commit()
            logger.info("Backfilled default avatars for %d users", len(blanks))


# ============================ AUTH ENDPOINTS ============================
def _default_avatar(name: str) -> str:
    """A clean, auto-generated geometric avatar (DiceBear 'shapes'), deterministic
    per name so every account looks distinct by default. Not fancy - just a
    colorful tile. Swap the style word below to change the whole app's default."""
    from urllib.parse import quote
    seed = quote((name or "user").strip()[:40] or "user")
    return f"https://api.dicebear.com/9.x/shapes/svg?seed={seed}"


@api_router.post("/auth/register")
async def register(body: RegisterRequest, request: Request, session: AsyncSession = Depends(get_session)):
    if not auth.rate_limit(f"reg:{client_ip(request)}", 10, 3600):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    hint = body.role if body.role in ("customer", "clipper") else "customer"
    email = body.email.lower()
    if await session.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    # Local signups start UNVERIFIED and get no session until they confirm their
    # email (compliance). Google accounts are verified by the provider.
    row = User(email=email, name=body.name.strip(), hashed_password=auth.hash_password(body.password),
               auth_provider=AuthProvider.local, avatar_url=_default_avatar(body.name),
               credits=0, onboarded=False, disabled=False, email_verified=False)
    session.add(row)
    await session.commit()
    _send_verification_email(row, hint)
    return {"verification_required": True, "email": email}


def _send_verification_email(row: User, hint: str) -> None:
    """Fire-and-forget a verification email with a signed 24h link."""
    try:
        token = auth.create_verification_token(str(row.id), hint)
        verify_url = f"{_email_base_url()}/verify-email?token={token}"
        html = _verification_email_html(row.name or "there", verify_url)
        asyncio.create_task(asyncio.to_thread(
            send_email, row.email, "Verify your email - 24 Hour Clipping", html))
    except Exception as e:
        logger.error("Verification email dispatch failed: %s", e)


@api_router.post("/auth/verify-email")
async def verify_email(body: VerifyEmailRequest, session: AsyncSession = Depends(get_session)):
    try:
        payload = auth.decode_verification_token(body.token)
    except Exception:
        raise HTTPException(400, "This verification link is invalid or has expired. "
                                 "Request a new one from the login page.")
    uid = as_uuid(payload.get("sub"))
    row = await session.scalar(select(User).options(selectinload(User.roles)).where(User.id == uid)) if uid else None
    if not row:
        raise HTTPException(404, "Account not found")
    if row.disabled:
        raise HTTPException(403, "Account disabled")
    if not row.email_verified:
        row.email_verified = True
        await session.commit()
    # Verified: log them in so they can go straight into onboarding.
    roles = _roles_list(row)
    hint = payload.get("hint") or "customer"
    return await _issue(_user_to_dict(row, active_role=hint if not roles else None, roles=roles))


@api_router.post("/auth/resend-verification")
async def resend_verification(body: ResendVerificationRequest, request: Request,
                              session: AsyncSession = Depends(get_session)):
    if not auth.rate_limit(f"resend:{client_ip(request)}", 5, 3600):
        raise HTTPException(429, "Too many requests. Please try again later.")
    email = body.email.lower()
    row = await session.scalar(select(User).where(User.email == email))
    # Only resend for a real, local, still-unverified account - but always return
    # a generic success so we never reveal whether an email is registered.
    if row and row.auth_provider == AuthProvider.local and not row.email_verified and not row.disabled:
        _send_verification_email(row, "customer")
    return {"ok": True}


@api_router.post("/auth/login")
async def login(body: LoginRequest, request: Request, session: AsyncSession = Depends(get_session)):
    if not auth.rate_limit(f"login:{client_ip(request)}", 15, 900):
        raise HTTPException(429, "Too many attempts. Please try again later.")
    row = await session.scalar(select(User).options(selectinload(User.roles))
                               .where(User.email == body.email.lower()))
    if not row or not auth.verify_password(body.password, row.hashed_password):
        raise HTTPException(401, "Invalid email or password")
    if row.disabled:
        raise HTTPException(403, "Account disabled")
    if row.auth_provider == AuthProvider.local and not row.email_verified:
        # Distinct code so the client can offer a "resend link" action.
        raise HTTPException(403, "email_not_verified")
    return await _issue(_user_to_dict(row))


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/switch-role")
async def switch_role(body: SwitchRoleRequest, user: dict = Depends(get_current_user)):
    """Flip the active dashboard mode for a multi-role account. Re-issues a JWT whose
    active `role` is the requested capability. The active role lives only in the token."""
    if body.role not in user_roles(user):
        raise HTTPException(403, "You don't have that role")
    user["role"] = body.role
    return await _issue(user)


@api_router.post("/auth/onboarding")
async def complete_onboarding(body: OnboardingRequest, user: dict = Depends(get_current_user),
                              session: AsyncSession = Depends(get_session)):
    """Finish signup: set the account's capabilities, seed a brand profile and/or
    clipper profile, grant customer credits once, and mark onboarded."""
    roles = [r for r in ("customer", "clipper") if r in body.roles]
    if not roles:
        raise HTTPException(400, "Pick at least one role")
    uid = as_uuid(user["id"])
    row = await session.get(User, uid)
    if not row:
        raise HTTPException(401, "User not found")
    prev = {r.value for r in await _load_role_values(session, uid)}
    await _ensure_roles(session, uid, roles)
    row.onboarded = True
    if "customer" in roles and "customer" not in prev and not row.credits:
        row.credits = 150
    if body.payout_wallet.strip():
        row.payout_wallet = body.payout_wallet.strip()

    if "customer" in roles and (body.brand_name or body.niche or body.content_type):
        exists = await session.scalar(select(BrandProfile.id).where(BrandProfile.owner_id == uid))
        if not exists:
            session.add(BrandProfile(owner_id=uid, name=body.brand_name or row.name,
                                     description=body.niche, audience=body.audience))

    if "clipper" in roles:
        # Load the profile (with portfolio) so replacing samples is async-safe.
        prof = await session.scalar(select(ClipperProfile)
                                    .options(selectinload(ClipperProfile.portfolio))
                                    .where(ClipperProfile.user_id == uid))
        if not prof:
            prof = await _ensure_clipper_profile_row(session, row)
        if body.specialties:
            prof.specialty = ", ".join(body.specialties[:3])
        if body.tools:
            prof.tools = body.tools
        if body.samples:
            prof.portfolio = [PortfolioItem(video_url=s, position=i) for i, s in enumerate(body.samples)]

    await session.commit()
    merged = prev | set(roles)
    active = body.active_role if body.active_role in merged else roles[0]
    return await _issue(_user_to_dict(row, active_role=active, roles=_order_roles(merged)))


@api_router.post("/auth/google")
async def google_auth(body: GoogleAuthRequest, session: AsyncSession = Depends(get_session)):
    try:
        info = auth.verify_google_credential(body.credential)
    except RuntimeError:
        raise HTTPException(503, "Google sign-in is not configured on this server")
    except Exception:
        raise HTTPException(401, "Invalid Google credential")
    email = info["email"].lower()
    row = await session.scalar(select(User).options(selectinload(User.roles))
                               .where(User.email == email))
    hint = body.role if body.role in ("customer", "clipper") else "customer"
    if not row:
        _nm = info.get("name") or email.split("@")[0]
        row = User(email=email, name=_nm,
                   auth_provider=AuthProvider.google, avatar_url=info.get("picture") or _default_avatar(_nm),
                   credits=0, onboarded=False, disabled=False)
        session.add(row)
        await session.commit()
        # Fresh account: no capabilities yet.
        return await _issue(_user_to_dict(row, active_role=hint, roles=[]))
    if row.disabled:
        raise HTTPException(403, "Account disabled")
    roles = _roles_list(row)
    return await _issue(_user_to_dict(row, active_role=hint if not roles else None, roles=roles))
# ========================== END AUTH ==========================


# ============================ MEDIA / UPLOADS ============================
class PresignRequest(BaseModel):
    kind: str = "source"
    filename: str = ""
    content_type: str = "application/octet-stream"
    contract_id: Optional[str] = None


async def _compute_upload_key(kind: str, filename: str, contract_id, user: dict, session: AsyncSession) -> str:
    """Compute the object key + enforce who may upload what."""
    ext = os.path.splitext(filename or "")[1].lower()
    ext = ext if len(ext) <= 10 and ext.startswith(".") else ""
    uid = uuid.uuid4().hex
    if kind == "delivery":
        if not contract_id:
            raise HTTPException(400, "contract_id required for a delivery upload")
        await _require_contract_party(session, contract_id, user, allow=("clipper",))
        return f"deliveries/{contract_id}/{uid}{ext}"
    if kind == "avatar":
        return f"avatars/{user['id']}/{uid}{ext}"
    if not ({"customer", "admin"} & set(user_roles(user))):
        raise HTTPException(403, "Only customers upload source footage")
    return f"sources/{user['id']}/{uid}{ext}"


@api_router.post("/uploads/presign")
async def presign_upload(body: PresignRequest, user: dict = Depends(get_current_user),
                         session: AsyncSession = Depends(get_session)):
    """Mint a presigned PUT URL so the browser uploads DIRECTLY to S3 (large video
    files never stream through our server)."""
    if not storage.is_s3():
        raise HTTPException(503, "Direct uploads are not enabled")
    ct = (body.content_type or "").lower()
    if body.kind == "avatar" and not ct.startswith("image/"):
        raise HTTPException(415, "Avatar must be an image")
    if not ct.startswith(("video/", "image/")):
        raise HTTPException(415, "Only video or image files are allowed")
    key = await _compute_upload_key(body.kind, body.filename, body.contract_id, user, session)
    return {"upload_url": storage.presign_put(key, body.content_type), "key": key}


@api_router.post("/uploads")
async def upload_media(kind: str = Form("source"), contract_id: Optional[str] = Form(None),
                       file: UploadFile = File(...), user: dict = Depends(get_current_user),
                       session: AsyncSession = Depends(get_session)):
    if kind == "avatar" and not (file.content_type or "").startswith("image/"):
        raise HTTPException(415, "Avatar must be an image")
    key = await _compute_upload_key(kind, file.filename, contract_id, user, session)
    try:
        size = await storage.save_upload(file, key)
    except storage.UploadError as e:
        raise HTTPException(e.status, e.message)
    return {"key": key, "name": file.filename, "size": size}


@api_router.get("/media/{key:path}")
async def get_media(key: str, exp: Optional[int] = None, sig: Optional[str] = None):
    if not storage.verify_media(key, exp, sig):
        raise HTTPException(403, "Invalid or expired media link")
    if storage.is_s3():
        # Redirect image/video links straight to a presigned S3 URL so bytes never
        # flow through our server.
        from fastapi.responses import RedirectResponse
        if not storage.object_exists(key):
            raise HTTPException(404, "Not found")
        return RedirectResponse(storage.presign_get(key, 3600))
    path = storage.safe_path(key)
    if path is None or not path.exists():
        raise HTTPException(404, "Not found")
    return FileResponse(path)


@api_router.get("/projects/{project_id}/source-url")
async def project_source_url(project_id: str, user: dict = Depends(get_current_user),
                             session: AsyncSession = Depends(get_session)):
    pid = as_uuid(project_id)
    p = await session.get(Project, pid) if pid else None
    if not p:
        raise HTTPException(404, "Project not found")
    if not p.source_key:
        raise HTTPException(404, "No uploaded source footage")
    allowed = "admin" in user_roles(user) or str(p.owner_id) == user["id"]
    if not allowed:
        uid = as_uuid(user["id"])
        has_bid = await session.scalar(select(Bid.id).where(
            Bid.project_id == p.id, Bid.clipper_id == uid))
        has_contract = await session.scalar(select(Contract.id).where(
            Contract.project_id == p.id, Contract.clipper_id == uid))
        allowed = bool(has_bid or has_contract)
    if not allowed:
        raise HTTPException(403, "Not authorized to access this footage")
    return {"url": storage.sign_media_url(p.source_key)}
# ========================== END MEDIA / UPLOADS ==========================


@api_router.get("/")
async def root():
    return {"message": "24 Hour Clipping API", "status": "live"}


# ============================ CLIPPERS ============================
async def _list_clippers(session: AsyncSession, limit: int = 100) -> list:
    profs = list(await session.scalars(
        select(ClipperProfile).options(selectinload(ClipperProfile.portfolio)).limit(limit)))
    uids = {p.user_id for p in profs}
    users = {u.id: u for u in await session.scalars(select(User).where(User.id.in_(uids)))} if uids else {}
    return [clipper_public(p, users.get(p.user_id)) for p in profs]


@api_router.get("/clippers")
async def get_clippers(session: AsyncSession = Depends(get_session)):
    return await _list_clippers(session)


@api_router.get("/clippers/{clipper_id}")
async def get_clipper(clipper_id: str, session: AsyncSession = Depends(get_session)):
    cid = as_uuid(clipper_id)
    prof = await session.scalar(select(ClipperProfile).options(selectinload(ClipperProfile.portfolio))
                                .where(ClipperProfile.user_id == cid)) if cid else None
    if not prof:
        raise HTTPException(404, "Clipper not found")
    u = await session.get(User, prof.user_id)
    return clipper_public(prof, u)


# ============================ PROJECTS ============================
@api_router.get("/projects")
async def get_projects(status: Optional[str] = None, category: Optional[str] = None,
                       mine: bool = False, user: Optional[dict] = Depends(get_current_user_optional),
                       session: AsyncSession = Depends(get_session)):
    stmt = select(Project).options(selectinload(Project.references))
    if status and status in ProjectStatus.__members__:
        stmt = stmt.where(Project.status == ProjectStatus(status))
    if category:
        stmt = stmt.where(Project.category == category)
    if mine:
        if not user:
            raise HTTPException(401, "Not authenticated")
        stmt = stmt.where(Project.owner_id == as_uuid(user["id"]))
    # Hidden projects are excluded from the public marketplace; owners (mine) and
    # admins still see them.
    is_admin = bool(user and "admin" in user_roles(user))
    if not mine and not is_admin:
        stmt = stmt.where(Project.hidden.is_(False))
    stmt = stmt.order_by(Project.created_at.desc()).limit(200)
    rows = list(await session.scalars(stmt))
    return await serialize_projects(session, rows)


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, session: AsyncSession = Depends(get_session)):
    pid = as_uuid(project_id)
    p = await session.scalar(select(Project).options(selectinload(Project.references))
                             .where(Project.id == pid)) if pid else None
    if not p:
        raise HTTPException(404, "Project not found")
    return await serialize_project(session, p)


def _free_posting_on() -> bool:
    """Temporary launch mode: creators post jobs live without paying. Flip
    FREE_POSTING=false in the backend .env to require payment again."""
    return os.environ.get("FREE_POSTING", "true").lower() not in ("false", "0", "no", "off")


def _publish_project_free(session: AsyncSession, p: Project, provider: str = "free") -> None:
    """Mark a project funded + open with a comp deposit (no real money moves).
    Powers the no-payment posting mode and admin comps. Caller commits.
    Requires p.id (flush first for a brand-new project)."""
    if p.funded:
        return
    p.funded = True
    p.status = ProjectStatus.open
    p.payment_method = provider
    session.add(Transaction(kind=TxnKind.deposit, status=TxnStatus.confirmed, project_id=p.id,
                            from_user=p.owner_id, amount=_base_units(p.budget, "usd"),
                            currency=Currency.usd, chain_sig=f"{provider}:{p.id}",
                            meta={"provider": provider}))


@api_router.get("/config")
async def public_config():
    """Public runtime flags the frontend adapts to."""
    return {"free_posting": _free_posting_on()}


@api_router.post("/projects")
async def create_project(body: ProjectCreate, user: dict = Depends(require_role("customer", "admin")),
                         session: AsyncSession = Depends(get_session)):
    if body.thumbnail_key:
        thumb = storage.sign_media_url(body.thumbnail_key, expires_in=365 * 24 * 3600)
    else:
        thumb = body.thumbnail or "https://images.pexels.com/photos/14540970/pexels-photo-14540970.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
    p = Project(
        owner_id=as_uuid(user["id"]),
        title=body.title, category=body.category, description=body.description or "",
        budget=body.budget, bond=bond_for(body.budget), status=ProjectStatus.draft, funded=False,
        official=("admin" in user_roles(user)),
        output_length=body.output_length, aspect_ratio=body.aspect_ratio, captions=body.captions,
        platform=body.platform, moment_mode=body.moment_mode, goal=body.goal, audience=body.audience,
        mood=body.mood, style=body.style, cta=body.cta, source_link=body.source_link,
        source_key=body.source_key, source_length=body.source_length, thumbnail_url=thumb,
        thumbnail_key=body.thumbnail_key, quality_notes=body.quality_notes,
        deadline_hours=body.deadline_hours, allow_extension=body.allow_extension,
    )
    # Assign (don't append) so the collection is initialised as loaded even when
    # empty - accessing an un-initialised relationship would lazy-load under async.
    p.references = [ProjectReference(url=url, position=i)
                    for i, url in enumerate(body.references or [])]
    session.add(p)
    # No-payment launch mode: post the job live for bids immediately (no checkout).
    if _free_posting_on():
        await session.flush()   # assign p.id for the comp deposit row
        _publish_project_free(session, p, "free")
    await session.commit()
    return project_public(p, user.get("name") or body.customer_name, 0)


@api_router.post("/projects/{project_id}/checkout")
async def create_card_checkout(project_id: str, user: dict = Depends(get_current_user),
                               session: AsyncSession = Depends(get_session)):
    p = await _require_project_owner(session, project_id, user)
    pdict = {"id": str(p.id), "budget": float(p.budget), "title": p.title}
    if square.is_configured():
        try:
            intent = square.create_payment_intent(pdict)
        except Exception as e:
            logger.error("Square checkout error: %s", e)
            raise HTTPException(502, "Could not start card checkout")
        await _set_setting(session, f"payintent:{p.id}", {"provider": "square", "id": intent["id"]})
        await session.commit()
        return {"url": intent["url"], "provider": "square", "test_mode": square.is_sandbox()}
    if payments.is_configured():
        try:
            url = payments.create_checkout_session(pdict)
        except Exception as e:
            logger.error("Stripe checkout error: %s", e)
            raise HTTPException(502, "Could not start card checkout")
        return {"url": url, "provider": "stripe", "test_mode": payments.is_test_mode()}
    raise HTTPException(503, "Card payments are not configured on this server")


@api_router.post("/projects/{project_id}/checkout/confirm")
async def confirm_card_checkout(project_id: str, body: dict, user: dict = Depends(get_current_user),
                                session: AsyncSession = Depends(get_session)):
    p = await _require_project_owner(session, project_id, user)
    if p.funded:
        return {"ok": True}
    if square.is_configured():
        setting = await _get_setting(session, f"payintent:{p.id}")
        ref = (setting or {}).get("id") if (setting or {}).get("provider") == "square" else None
        if not ref:
            raise HTTPException(400, "No pending Square payment for this project")
        try:
            status = square.get_status(ref)
        except Exception as e:
            logger.error("Square confirm error: %s", e)
            raise HTTPException(502, "Could not verify payment")
        if status != "completed":
            raise HTTPException(402, f"Payment not completed (status: {status})")
        p.funded = True
        p.status = ProjectStatus.open
        p.payment_method = "square"
        session.add(Transaction(kind=TxnKind.deposit, status=TxnStatus.confirmed, project_id=p.id,
                                from_user=as_uuid(user["id"]), amount=_base_units(p.budget, "usd"),
                                currency=Currency.usd, chain_sig=ref, meta={"provider": "square"}))
        await session.commit()
        return {"ok": True}
    if payments.is_configured():
        session_id = (body or {}).get("session_id")
        if not session_id:
            raise HTTPException(400, "session_id required")
        try:
            paid = payments.session_is_paid(session_id, str(p.id))
        except Exception as e:
            logger.error("Stripe confirm error: %s", e)
            raise HTTPException(502, "Could not verify payment")
        if not paid:
            raise HTTPException(402, "Payment not completed")
        p.funded = True
        p.status = ProjectStatus.open
        p.payment_method = "card"
        session.add(Transaction(kind=TxnKind.deposit, status=TxnStatus.confirmed, project_id=p.id,
                                from_user=as_uuid(user["id"]), amount=_base_units(p.budget, "usd"),
                                currency=Currency.usd, chain_sig=session_id, meta={"provider": "stripe"}))
        await session.commit()
        return {"ok": True}
    raise HTTPException(503, "Card payments are not configured on this server")


# ============================ SOLANA USDC ============================
@api_router.get("/solana/config")
async def solana_config():
    return solpay.config_public()


@api_router.get("/projects/{project_id}/solana/deposit-info")
async def solana_deposit_info(project_id: str, user: dict = Depends(get_current_user),
                              session: AsyncSession = Depends(get_session)):
    p = await _require_project_owner(session, project_id, user)
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payments are not configured on this server")
    budget = float(p.budget)
    options = {"usdc": {"amount": budget}}
    try:
        price = await asyncio.to_thread(solpay.get_sol_price_usd)
        options["sol"] = {"amount": round(budget / price, 6), "price": price}
    except Exception as e:
        logger.warning("SOL price fetch failed: %s", e)
    return {"treasury": solpay.treasury_pubkey(), "budget": budget, "amount": budget,
            "usdc_mint": solpay.USDC_MINT_STR, "network": solpay.NETWORK,
            "decimals": solpay.DECIMALS, "options": options}


@api_router.post("/projects/{project_id}/fund/solana")
async def solana_fund(project_id: str, body: SolanaFundRequest, user: dict = Depends(get_current_user),
                      session: AsyncSession = Depends(get_session)):
    p = await _require_project_owner(session, project_id, user)
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payments are not configured on this server")
    currency = "sol" if body.currency == "sol" else "usdc"
    sig = body.signature.strip()
    if await session.scalar(select(Transaction).where(Transaction.chain_sig == sig)):
        raise HTTPException(409, "This payment has already been used")
    try:
        res = await asyncio.to_thread(solpay.verify_deposit, sig, float(p.budget), currency)
    except solpay.PaymentError as e:
        raise HTTPException(402, f"Payment not verified: {e}")
    except Exception as e:
        logger.error("Solana deposit verify error: %s", e)
        raise HTTPException(502, "Could not verify the Solana payment")
    p.funded = True
    p.status = ProjectStatus.open
    p.payment_method = f"solana_{currency}"
    session.add(Transaction(kind=TxnKind.deposit, status=TxnStatus.confirmed, project_id=p.id,
                            from_user=as_uuid(user["id"]), amount=_base_units(res["received"], currency),
                            currency=Currency(currency), chain_sig=sig,
                            meta={"received": res["received"], "usd_value": res.get("usd_value")}))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "This payment has already been used")
    return {"ok": True, "received": res["received"], "currency": currency, "signature": sig}


@api_router.get("/me/payout-wallet")
async def get_payout_wallet(user: dict = Depends(get_current_user)):
    return {"wallet": user.get("payout_wallet")}


@api_router.post("/me/payout-wallet")
async def set_payout_wallet(body: PayoutWalletRequest, user: dict = Depends(get_current_user),
                            session: AsyncSession = Depends(get_session)):
    wallet = body.wallet.strip()
    if not solpay.is_valid_pubkey(wallet):
        raise HTTPException(400, "That is not a valid Solana wallet address")
    row = await session.get(User, as_uuid(user["id"]))
    row.payout_wallet = wallet
    await session.commit()
    return {"ok": True, "wallet": wallet}


@api_router.post("/me/paypal-email")
async def set_paypal_email(body: PayoutEmailRequest, user: dict = Depends(get_current_user),
                           session: AsyncSession = Depends(get_session)):
    email = body.email.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Enter a valid PayPal email address")
    row = await session.get(User, as_uuid(user["id"]))
    row.paypal_email = email
    await session.commit()
    return {"ok": True, "paypal_email": email}


MIN_WITHDRAWAL_CENTS = 2000  # $20

async def _clipper_balance_cents(session: AsyncSession, clipper_id) -> int:
    """Withdrawable USD balance (base units) = approved earnings minus withdrawals.
    Only platform-held payouts count (tips are paid clipper-to-clipper on-chain)."""
    credited = await session.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.kind == TxnKind.payout, Transaction.status == TxnStatus.confirmed,
        Transaction.to_user == clipper_id, Transaction.currency == Currency.usd)) or 0
    withdrawn = await session.scalar(select(func.coalesce(func.sum(Withdrawal.amount), 0)).where(
        Withdrawal.clipper_id == clipper_id, Withdrawal.status != WithdrawalStatus.failed)) or 0
    return int(credited) - int(withdrawn)


@api_router.get("/me/balance")
async def my_balance(user: dict = Depends(get_current_user),
                     session: AsyncSession = Depends(get_session)):
    uid = as_uuid(user["id"])
    cents = await _clipper_balance_cents(session, uid)
    total = await session.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.kind == TxnKind.payout, Transaction.status == TxnStatus.confirmed,
        Transaction.to_user == uid, Transaction.currency == Currency.usd)) or 0
    row = await session.get(User, uid)
    return {"available": round(cents / 100, 2), "lifetime_earned": round(int(total) / 100, 2),
            "currency": "usd", "min_withdrawal": MIN_WITHDRAWAL_CENTS / 100,
            "method": "paypal", "paypal_email": row.paypal_email,
            "payout_wallet": row.payout_wallet}


@api_router.get("/me/transactions")
async def my_transactions(user: dict = Depends(get_current_user),
                          session: AsyncSession = Depends(get_session)):
    """The caller's money history: deposits they funded, tips sent/received,
    payouts, refunds. `direction` is 'out' when the caller paid, 'in' when they
    received. Amounts are returned in major units (dollars for usd)."""
    uid = as_uuid(user["id"])
    rows = (await session.scalars(
        select(Transaction)
        .where(or_(Transaction.from_user == uid, Transaction.to_user == uid))
        .order_by(Transaction.created_at.desc()).limit(300))).all()
    pids = {t.project_id for t in rows if t.project_id}
    titles = {}
    if pids:
        for p in (await session.scalars(select(Project).where(Project.id.in_(pids)))).all():
            titles[p.id] = p.title
    out = []
    for t in rows:
        cur = getattr(t.currency, "value", str(t.currency))
        amount = int(t.amount) / (10 ** _dec(cur))
        out.append({
            "id": str(t.id),
            "kind": getattr(t.kind, "value", str(t.kind)),
            "status": getattr(t.status, "value", str(t.status)),
            "currency": cur,
            "direction": "out" if str(t.from_user) == user["id"] else "in",
            "amount": round(amount, 2 if cur == "usd" else 6),
            "project_id": str(t.project_id) if t.project_id else None,
            "project_title": titles.get(t.project_id),
            "method": (t.meta or {}).get("provider"),
            "reference": t.chain_sig,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })
    return out


@api_router.post("/me/withdraw")
async def withdraw(body: WithdrawRequest, user: dict = Depends(require_role("clipper", "admin")),
                   session: AsyncSession = Depends(get_session)):
    uid = as_uuid(user["id"])
    cents = await _clipper_balance_cents(session, uid)
    if cents < MIN_WITHDRAWAL_CENTS:
        raise HTTPException(400, f"Minimum withdrawal is ${MIN_WITHDRAWAL_CENTS/100:.0f}. "
                                 f"Your balance is ${cents/100:.2f}.")
    row = await session.get(User, uid)
    method = body.method if body.method in ("usdc", "paypal") else "paypal"
    if method == "paypal":
        dest = (body.destination or "").strip().lower() or (row.paypal_email or "")
        if not dest:
            raise HTTPException(409, "Add your PayPal email first")
        if dest != (row.paypal_email or ""):   # remember it for next time
            row.paypal_email = dest
    else:  # usdc
        dest = (body.destination or "").strip() or (row.payout_wallet or "")
        if not dest:
            raise HTTPException(409, "Set a Solana payout wallet first")
    usd = round(cents / 100, 2)
    # Record the withdrawal first (pending immediately reduces the available balance,
    # preventing a double-withdraw), then execute on the chosen rail.
    w = Withdrawal(clipper_id=uid, amount=cents, currency=Currency.usd, method=method,
                   destination=dest, status=WithdrawalStatus.pending)
    session.add(w)
    await session.flush()
    if method == "paypal" and paypal.is_configured():
        try:
            res = await asyncio.to_thread(paypal.send_payout, dest, usd, "24 Hour Clipping earnings")
            w.status = WithdrawalStatus.paid
            w.chain_sig = res.get("batch_id")
            w.note = f"paypal batch {res.get('status')}"
        except Exception as e:
            w.status = WithdrawalStatus.failed
            await session.commit()
            logger.error("PayPal withdrawal failed for %s: %s", uid, e)
            raise HTTPException(502, "PayPal payout failed. Check your PayPal email and try again.")
    elif method == "usdc" and solpay.is_configured():
        try:
            pay = await asyncio.to_thread(solpay.send_payout, dest, usd, "usdc")
            w.status = WithdrawalStatus.paid
            w.chain_sig = pay["signature"]
        except Exception as e:
            w.status = WithdrawalStatus.failed
            await session.commit()
            logger.error("USDC withdrawal failed for %s: %s", uid, e)
            raise HTTPException(502, "Payout failed - the treasury may be low. Try again shortly.")
    else:
        # Provider not configured yet: held as pending for batch/manual processing.
        w.note = "queued for payout"
    await session.commit()
    return {"ok": True, "amount": usd, "method": method, "status": w.status.value,
            "signature": w.chain_sig, "destination": dest}


@api_router.put("/me/clipper-profile")
async def update_clipper_profile(body: ClipperProfileUpdate,
                                 user: dict = Depends(require_role("clipper", "admin")),
                                 session: AsyncSession = Depends(get_session)):
    row = await session.get(User, as_uuid(user["id"]))
    await _ensure_clipper_profile_row(session, row)
    # Load with portfolio eager so the serializer never lazy-loads it.
    prof = await session.scalar(select(ClipperProfile).options(selectinload(ClipperProfile.portfolio))
                                .where(ClipperProfile.user_id == row.id))
    if body.name and body.name.strip():
        row.name = body.name.strip()[:60]
    if body.specialty is not None:
        prof.specialty = body.specialty.strip()[:60] or "New Clipper"
    if body.price_range is not None:
        prof.price_min, prof.price_max = _parse_price_range(body.price_range)
    if body.tools is not None:
        prof.tools = [t.strip() for t in body.tools if t.strip()][:12]
    if body.bio is not None:
        prof.bio = body.bio.strip()[:1000]
    if body.avatar_key:
        row.avatar_url = storage.sign_media_url(body.avatar_key, expires_in=365 * 24 * 3600)
    elif body.avatar_url:
        row.avatar_url = body.avatar_url.strip()
    await session.commit()
    return clipper_public(prof, row)


async def _pay_contract(session: AsyncSession, contract: Contract) -> dict:
    """Send the clipper's payout for a completed contract (idempotent via the ledger)."""
    existing = await session.scalar(select(Transaction).where(
        Transaction.kind == TxnKind.payout, Transaction.contract_id == contract.id))
    if existing:
        # Approval already credited the clipper's balance; payouts now go out via
        # /me/withdraw, so this legacy per-contract path is a no-op.
        return {"already_paid": True, "signature": existing.chain_sig,
                "note": "credited to clipper balance; withdraw via /me/withdraw"}
    clipper = await session.get(User, contract.clipper_id)
    wallet = clipper.payout_wallet if clipper else None
    if not wallet:
        raise HTTPException(409, "Clipper has not set a Solana payout wallet yet")
    proj = await session.get(Project, contract.project_id)
    currency = "sol" if (proj and proj.payment_method == "solana_sol") else "usdc"
    split = solpay.payout_split(float(contract.price))
    try:
        pay = await asyncio.to_thread(solpay.send_payout, wallet, split["clipper"], currency)
    except solpay.PaymentError as e:
        raise HTTPException(502, f"Payout failed: {e}")
    except Exception as e:
        logger.error("Solana payout error: %s", e)
        raise HTTPException(502, "Payout failed - check treasury balance and try again")
    session.add(Transaction(kind=TxnKind.payout, status=TxnStatus.confirmed, contract_id=contract.id,
                            project_id=contract.project_id, to_user=clipper.id,
                            amount=_base_units(pay["amount"], pay["currency"]),
                            currency=Currency(pay["currency"]), chain_sig=pay["signature"],
                            meta={"clipper": split["clipper"], "fee": split["fee"], "wallet": wallet,
                                  "sent": pay["amount"], "at": now_iso()}))
    await session.commit()
    return {"paid": True, "signature": pay["signature"], "currency": pay["currency"],
            "sent": pay["amount"], **split}


@api_router.post("/contracts/{contract_id}/payout")
async def contract_payout(contract_id: str, user: dict = Depends(get_current_user),
                          session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user, allow=("customer",))
    if c.status != ContractStatus.completed:
        raise HTTPException(409, "Contract must be approved/completed before payout")
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payouts are not configured on this server")
    return await _pay_contract(session, c)


@api_router.post("/contracts/{contract_id}/tip")
async def contract_tip(contract_id: str, body: TipRequest, user: dict = Depends(get_current_user),
                       session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user, allow=("customer",))
    currency = "sol" if body.currency == "sol" else "usdc"
    if not solpay.is_configured():
        raise HTTPException(503, "Solana payments are not configured on this server")
    clipper = await session.get(User, c.clipper_id)
    wallet = clipper.payout_wallet if clipper else None
    if not wallet:
        raise HTTPException(409, "Clipper has not set a Solana wallet yet")
    sig = body.signature.strip()
    if await session.scalar(select(Transaction).where(Transaction.chain_sig == sig)):
        raise HTTPException(409, "This tip has already been recorded")
    try:
        received = await asyncio.to_thread(solpay.verify_tip, sig, wallet, float(body.amount), currency)
    except solpay.PaymentError as e:
        raise HTTPException(402, f"Tip not verified: {e}")
    except Exception as e:
        logger.error("Solana tip verify error: %s", e)
        raise HTTPException(502, "Could not verify the tip")
    unit = currency.upper()
    session.add(Transaction(kind=TxnKind.tip, status=TxnStatus.confirmed, contract_id=c.id,
                            project_id=c.project_id, from_user=as_uuid(user["id"]), to_user=clipper.id,
                            amount=_base_units(received, currency), currency=Currency(currency),
                            chain_sig=sig, meta={"amount": received}))
    session.add(Message(contract_id=c.id, sender_id=as_uuid(user["id"]), sender_role=UserRole.customer,
                        text=f"\U0001F49C Tipped the clipper {received} {unit} (no fee)"))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "This tip has already been recorded")
    return {"ok": True, "amount": received, "currency": currency, "signature": sig}
# ========================== END SOLANA USDC ==========================


# ============================ BIDS ============================
@api_router.get("/projects/{project_id}/bids")
async def get_bids(project_id: str, user: dict = Depends(get_current_user),
                   session: AsyncSession = Depends(get_session)):
    pid = as_uuid(project_id)
    proj = await session.get(Project, pid) if pid else None
    if not proj:
        raise HTTPException(404, "Project not found")
    is_owner = str(proj.owner_id) == user["id"]
    has_bid = await session.scalar(select(Bid.id).where(
        Bid.project_id == pid, Bid.clipper_id == as_uuid(user["id"])))
    if not (is_owner or "admin" in user_roles(user) or has_bid):
        raise HTTPException(403, "Not authorized to view bids for this project")
    rows = list(await session.scalars(
        select(Bid).where(Bid.project_id == pid).order_by(Bid.created_at.desc()).limit(100)))
    return await attach_clipper(session, [bid_public(b) for b in rows])


@api_router.get("/me/bids")
async def my_bids(user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    """The signed-in clipper's own bids across all projects, newest first, each
    annotated with its project's title/status/budget."""
    rows = list(await session.scalars(select(Bid).where(
        Bid.clipper_id == as_uuid(user["id"])).order_by(Bid.created_at.desc()).limit(200)))
    pids = {b.project_id for b in rows}
    pmap = {p.id: p for p in await session.scalars(select(Project).where(Project.id.in_(pids)))} if pids else {}
    out = []
    for b in rows:
        d = bid_public(b)
        p = pmap.get(b.project_id)
        d["project_title"] = p.title if p else "Project"
        d["project_status"] = p.status.value if p else None
        d["project_budget"] = float(p.budget) if p else None
        out.append(d)
    return out


@api_router.post("/projects/{project_id}/bids")
async def create_bid(project_id: str, body: BidCreate,
                     user: dict = Depends(require_role("clipper", "admin")),
                     session: AsyncSession = Depends(get_session)):
    pid = as_uuid(project_id)
    project = await session.get(Project, pid) if pid else None
    if not project:
        raise HTTPException(404, "Project not found")
    if project.status != ProjectStatus.open:
        raise HTTPException(409, "This project is not accepting bids")
    uid = as_uuid(user["id"])
    dupe = await session.scalar(select(Bid.id).where(
        Bid.project_id == pid, Bid.clipper_id == uid, Bid.status == BidStatus.pending))
    if dupe:
        raise HTTPException(409, "You already have a pending bid on this project")
    row = await session.get(User, uid)
    await _ensure_clipper_profile_row(session, row)
    bid = Bid(project_id=pid, clipper_id=uid, amount=body.amount, pitch=body.pitch,
              eta_hours=body.eta_hours, bond_required=bond_for(body.amount), status=BidStatus.pending)
    session.add(bid)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "You already have a pending bid on this project")
    return (await attach_clipper(session, [bid_public(bid)]))[0]


@api_router.post("/bids/{bid_id}/accept")
async def accept_bid(bid_id: str, user: dict = Depends(get_current_user),
                     session: AsyncSession = Depends(get_session)):
    bid = await session.get(Bid, as_uuid(bid_id)) if as_uuid(bid_id) else None
    if not bid:
        raise HTTPException(404, "Bid not found")
    project = await _require_project_owner(session, str(bid.project_id), user)
    if bid.status != BidStatus.pending:
        existing = await session.scalar(select(Contract).where(Contract.bid_id == bid.id))
        if existing:
            return (await enrich_contracts(session, [existing]))[0]
        raise HTTPException(409, "This bid has already been handled")
    base_hours = int(project.deadline_hours or 24)
    allow_extension = bool(project.allow_extension)
    started = datetime.now(timezone.utc)
    deadline = started + timedelta(hours=base_hours)
    bid.status = BidStatus.accepted
    contract = Contract(bid_id=bid.id, project_id=bid.project_id, clipper_id=bid.clipper_id,
                        price=bid.amount, bond=bid.bond_required, status=ContractStatus.live,
                        base_hours=base_hours, extended_hours=0, allow_extension=allow_extension,
                        started_at=started, deadline_at=deadline, payment_method="escrow")
    session.add(contract)
    project.status = ProjectStatus.contract_live
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(select(Contract).where(Contract.bid_id == bid.id))
        if existing:
            return (await enrich_contracts(session, [existing]))[0]
        raise HTTPException(409, "This bid has already been handled")
    try:
        clip_user = await session.get(User, bid.clipper_id)
        if clip_user and clip_user.email:
            title = project.title or "your project"
            html = _acceptance_email_html(clip_user.name or "there", title, float(bid.amount), deadline.isoformat())
            await asyncio.to_thread(send_email, clip_user.email, f"You're hired: {title}", html)
    except Exception as e:
        logger.error("acceptance email error: %s", e)
    return (await enrich_contracts(session, [contract]))[0]


async def _bid_party(session: AsyncSession, bid_id: str, user: dict):
    """A bid conversation is between the project owner and the bidding clipper."""
    bid = await session.get(Bid, as_uuid(bid_id)) if as_uuid(bid_id) else None
    if not bid:
        raise HTTPException(404, "Bid not found")
    proj = await session.get(Project, bid.project_id)
    is_owner = proj is not None and str(proj.owner_id) == user["id"]
    is_clipper = str(bid.clipper_id) == user["id"]
    if "admin" in user_roles(user) or is_owner or is_clipper:
        return bid, is_owner
    raise HTTPException(403, "You are not part of this conversation")


@api_router.get("/bids/{bid_id}/messages")
async def get_bid_messages(bid_id: str, user: dict = Depends(get_current_user),
                           session: AsyncSession = Depends(get_session)):
    await _bid_party(session, bid_id, user)
    rows = list(await session.scalars(select(Message).where(
        Message.bid_id == as_uuid(bid_id)).order_by(Message.created_at.asc()).limit(300)))
    return await serialize_messages(session, rows)


@api_router.post("/bids/{bid_id}/messages")
async def post_bid_message(bid_id: str, body: MessageCreate, user: dict = Depends(get_current_user),
                           session: AsyncSession = Depends(get_session)):
    bid, is_owner = await _bid_party(session, bid_id, user)
    sender = "admin" if user.get("role") == "admin" else ("customer" if is_owner else "clipper")
    msg = Message(bid_id=bid.id, sender_id=as_uuid(user["id"]), sender_role=UserRole(sender), text=body.text)
    session.add(msg)
    await session.commit()
    d = message_public(msg, user.get("name"))
    d["project_id"] = str(bid.project_id)
    return d


# ============================ CONTRACTS ============================
@api_router.get("/contracts")
async def get_contracts(status: Optional[str] = None, user: dict = Depends(get_current_user),
                        session: AsyncSession = Depends(get_session)):
    stmt = select(Contract)
    if status and status in ContractStatus.__members__:
        stmt = stmt.where(Contract.status == ContractStatus(status))
    rows = list(await session.scalars(stmt.limit(300)))
    # Scope by CAPABILITY, not the active dashboard: a user sees every contract
    # where they are the clipper OR own the project. Admins see everything.
    if "admin" not in user_roles(user):
        uid = as_uuid(user["id"])
        pids = {c.project_id for c in rows}
        owned = set(await session.scalars(select(Project.id).where(
            Project.id.in_(pids), Project.owner_id == uid))) if pids else set()
        rows = [c for c in rows if c.clipper_id == uid or c.project_id in owned]
    return await enrich_contracts(session, rows)


@api_router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, user: dict = Depends(get_current_user),
                       session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user)
    return (await enrich_contracts(session, [c]))[0]


@api_router.post("/contracts/{contract_id}/activate")
async def activate_contract(contract_id: str, user: dict = Depends(get_current_user),
                            session: AsyncSession = Depends(get_session)):
    # In the current flow a contract goes live the moment a bid is accepted, so
    # there is no pre-live state to activate. Kept for API compatibility.
    await _require_contract_party(session, contract_id, user, allow=("clipper",))
    raise HTTPException(409, "This contract is already running.")


EXTENSION_CAP_HOURS = 48


@api_router.post("/contracts/{contract_id}/extend")
async def extend_contract(contract_id: str, body: ExtendRequest, user: dict = Depends(get_current_user),
                          session: AsyncSession = Depends(get_session)):
    """Clipper adds time to the deadline, but only when the creator opted in and up
    to a hard cap. Posts a note to the shared chat so the creator sees it."""
    c = await _require_contract_party(session, contract_id, user, allow=("clipper",))
    if not c.allow_extension:
        raise HTTPException(403, "The creator didn't allow deadline extensions on this job.")
    if c.status not in (ContractStatus.live, ContractStatus.revision):
        raise HTTPException(409, "Only an active contract can be extended.")
    already = int(c.extended_hours or 0)
    add = min(body.hours, EXTENSION_CAP_HOURS - already)
    if add <= 0:
        raise HTTPException(409, f"You've hit the {EXTENSION_CAP_HOURS}h extension cap on this job.")
    c.deadline_at = c.deadline_at + timedelta(hours=add)
    c.extended_hours = already + add
    session.add(Message(contract_id=c.id, sender_id=as_uuid(user["id"]), sender_role=UserRole.clipper,
                        text=f"Deadline extended by {add}h (the creator allows extensions on this job)."))
    await session.commit()
    return {"ok": True, "deadline_at": c.deadline_at.isoformat(), "extended_hours": already + add,
            "remaining_extension": EXTENSION_CAP_HOURS - (already + add)}


@api_router.post("/contracts/{contract_id}/deliver")
async def deliver(contract_id: str, body: DeliveryCreate, user: dict = Depends(get_current_user),
                  session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user, allow=("clipper",))
    if c.status not in (ContractStatus.live, ContractStatus.revision):
        raise HTTPException(409, "You can only deliver on a live or in-revision contract.")
    existing = await session.scalar(select(func.count()).select_from(Delivery)
                                    .where(Delivery.contract_id == c.id))
    version_num = (existing or 0) + 1
    d = Delivery(
        contract_id=c.id, version=version_num, object_key=body.key,
        url=None if body.key else (body.url or "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"),
        thumb_url=None, note=body.note or "First cut submitted.",
    )
    session.add(d)
    c.status = ContractStatus.delivered
    proj = await session.get(Project, c.project_id)
    if proj:
        proj.status = ProjectStatus.delivered
    await session.commit()
    return _version_json(d)


@api_router.post("/contracts/{contract_id}/revision")
async def request_revision(contract_id: str, body: MessageCreate, user: dict = Depends(get_current_user),
                           session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user, allow=("customer",))
    if c.status != ContractStatus.delivered:
        raise HTTPException(409, "You can only request a revision on a delivered cut.")
    c.status = ContractStatus.revision
    session.add(Message(contract_id=c.id, sender_id=as_uuid(user["id"]), sender_role=UserRole.customer,
                        text=f"REVISION REQUEST: {body.text}"))
    await session.commit()
    return {"ok": True}


@api_router.post("/contracts/{contract_id}/approve")
async def approve(contract_id: str, body: RateRequest, user: dict = Depends(get_current_user),
                  session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user, allow=("customer",))
    if c.status not in (ContractStatus.delivered, ContractStatus.revision):
        raise HTTPException(409, "You can only approve a delivered cut.")
    # Atomic claim guards against double-approval / double-payout.
    res = await session.execute(update(Contract).where(
        Contract.id == c.id,
        Contract.status.in_([ContractStatus.delivered, ContractStatus.revision])
    ).values(status=ContractStatus.completed, rating_given=body.rating))
    if res.rowcount == 0:
        await session.rollback()
        raise HTTPException(409, "This contract has already been completed.")
    proj = await session.get(Project, c.project_id)
    if proj:
        proj.status = ProjectStatus.completed
    await session.commit()
    split = solpay.payout_split(float(c.price))
    # Credit the clipper's USD balance (works for Square/fiat- and Solana-funded jobs
    # alike). The money leaves later via /me/withdraw. Idempotent: one payout ledger
    # row per contract.
    existing = await session.scalar(select(Transaction.id).where(
        Transaction.kind == TxnKind.payout, Transaction.contract_id == c.id))
    if not existing:
        session.add(Transaction(kind=TxnKind.payout, status=TxnStatus.confirmed,
                                contract_id=c.id, project_id=c.project_id, to_user=c.clipper_id,
                                amount=_base_units(split["clipper"], "usd"), currency=Currency.usd,
                                meta={"clipper": split["clipper"], "fee": split["fee"],
                                      "source": (proj.payment_method if proj else None), "at": now_iso()}))
        session.add(Transaction(kind=TxnKind.fee, status=TxnStatus.confirmed,
                                contract_id=c.id, project_id=c.project_id,
                                amount=_base_units(split["fee"], "usd"), currency=Currency.usd,
                                meta={"at": now_iso()}))
        await session.commit()
    return {"ok": True, "payout": split["clipper"], "fee": split["fee"],
            "bond_returned": float(c.bond or 0), "credited": True}


@api_router.post("/contracts/{contract_id}/rescue")
async def trigger_rescue(contract_id: str, user: dict = Depends(get_current_user),
                         session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user, allow=("customer",))
    if c.status not in (ContractStatus.live, ContractStatus.revision, ContractStatus.delivered):
        raise HTTPException(409, "Only an active contract can be sent to rescue.")
    c.status = ContractStatus.rescue
    proj = await session.get(Project, c.project_id)
    if proj:
        proj.status = ProjectStatus.rescue
    await session.commit()
    return {"ok": True, "refund": float(c.price), "bond_credit": float(c.bond or 0)}


@api_router.post("/contracts/{contract_id}/relaunch")
async def relaunch(contract_id: str, user: dict = Depends(get_current_user),
                   session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user, allow=("customer",))
    if c.status != ContractStatus.rescue:
        raise HTTPException(409, "Only a contract in rescue can be relaunched.")
    proj = await session.get(Project, c.project_id)
    if proj:
        proj.status = ProjectStatus.open
    c.status = ContractStatus.closed_rescued
    await session.commit()
    return {"ok": True}


@api_router.get("/contracts/{contract_id}/messages")
async def get_messages(contract_id: str, user: dict = Depends(get_current_user),
                       session: AsyncSession = Depends(get_session)):
    await _require_contract_party(session, contract_id, user)
    rows = list(await session.scalars(select(Message).where(
        Message.contract_id == as_uuid(contract_id)).order_by(Message.created_at.asc()).limit(200)))
    return await serialize_messages(session, rows)


@api_router.post("/contracts/{contract_id}/messages")
async def post_message(contract_id: str, body: MessageCreate, user: dict = Depends(get_current_user),
                       session: AsyncSession = Depends(get_session)):
    c = await _require_contract_party(session, contract_id, user)
    sender = "clipper" if str(c.clipper_id) == user["id"] else "customer"
    msg = Message(contract_id=c.id, sender_id=as_uuid(user["id"]), sender_role=UserRole(sender), text=body.text)
    session.add(msg)
    await session.commit()
    return message_public(msg, user.get("name"))


# ============================ BRAND PROFILES ============================
@api_router.get("/brand-profiles")
async def get_brand_profiles(user: dict = Depends(get_current_user),
                             session: AsyncSession = Depends(get_session)):
    if "admin" in user_roles(user):
        rows = await session.scalars(select(BrandProfile).limit(50))
    else:
        rows = await session.scalars(select(BrandProfile).where(
            BrandProfile.owner_id == as_uuid(user["id"])).limit(20))
    return [brand_public(bp) for bp in rows]


@api_router.put("/brand-profiles/{profile_id}")
async def update_brand_profile(profile_id: str, body: BrandProfileUpdate,
                               user: dict = Depends(get_current_user),
                               session: AsyncSession = Depends(get_session)):
    pid = as_uuid(profile_id)
    existing = await session.get(BrandProfile, pid) if pid else None
    if existing and "admin" not in user_roles(user) and str(existing.owner_id) != user["id"]:
        raise HTTPException(403, "You do not own this brand profile")
    if existing:
        existing.name = body.name
        existing.description = body.description
        existing.audience = body.audience
        existing.caption_style = body.caption_style
        existing.pacing = body.pacing
        existing.cta = body.cta
        existing.avoid = body.avoid
        existing.fonts = body.fonts
        existing.colors = [c for c in body.colors if c][:8]
        bp = existing
    else:
        bp = BrandProfile(owner_id=as_uuid(user["id"]), name=body.name, description=body.description,
                          audience=body.audience, caption_style=body.caption_style, pacing=body.pacing,
                          cta=body.cta, avoid=body.avoid, fonts=body.fonts,
                          colors=[c for c in body.colors if c][:8])
        session.add(bp)
    await session.commit()
    return brand_public(bp)


# ============================ ADMIN ============================
@api_router.get("/admin/overview")
async def admin_overview(user: dict = Depends(require_role("admin")),
                         session: AsyncSession = Depends(get_session)):
    project_rows = list(await session.scalars(
        select(Project).options(selectinload(Project.references)).limit(300)))
    projects = await serialize_projects(session, project_rows)
    contract_rows = list(await session.scalars(select(Contract).limit(300)))
    contracts = await enrich_contracts(session, contract_rows)
    bid_rows = list(await session.scalars(select(Bid).limit(300)))
    bids = [bid_public(b) for b in bid_rows]
    clippers = await _list_clippers(session)
    completed = [c for c in contracts if c["status"] == "completed"]
    total_users = await session.scalar(select(func.count()).select_from(User))
    return {
        "stats": {
            "total_users": total_users or 0,
            "total_projects": len(projects),
            "open_projects": len([p for p in projects if p["status"] == "open"]),
            "live_contracts": len([c for c in contracts if c["status"] == "live"]),
            "rescue_mode": len([c for c in contracts if c["status"] == "rescue"]),
            "total_bids": len(bids),
            "clippers": len(clippers),
            "fees_earned": round(sum(c["price"] * 0.08 for c in completed), 2),
            "bonds_locked": round(sum(c["bond"] for c in contracts
                                      if c["status"] in ("live", "delivered", "revision")), 2),
        },
        "projects": projects, "contracts": contracts, "bids": bids, "clippers": clippers,
    }


@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_role("admin")),
                      q: Optional[str] = None, role: Optional[str] = None,
                      session: AsyncSession = Depends(get_session)):
    stmt = select(User).options(selectinload(User.roles))
    if role and role in UserRole.__members__:
        stmt = stmt.where(User.roles.any(UserRoleAssoc.role == UserRole(role)))
    if q:
        safe = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{safe}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.name.ilike(like)))
    stmt = stmt.order_by(User.created_at.desc()).limit(1000)
    rows = await session.scalars(stmt)
    return [_admin_user_json(u) for u in rows]


@api_router.post("/admin/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, admin: dict = Depends(require_role("admin")),
                             session: AsyncSession = Depends(get_session)):
    uid = as_uuid(user_id)
    target = await session.scalar(select(User).options(selectinload(User.roles))
                                  .where(User.id == uid)) if uid else None
    if not target:
        raise HTTPException(404, "User not found")
    if str(target.id) == admin["id"]:
        raise HTTPException(400, "You cannot suspend yourself")
    if "admin" in _roles_list(target):
        raise HTTPException(400, "Admin accounts cannot be suspended")
    target.disabled = True
    await session.commit()
    return {"ok": True}


@api_router.post("/admin/users/{user_id}/restore")
async def admin_restore_user(user_id: str, admin: dict = Depends(require_role("admin")),
                             session: AsyncSession = Depends(get_session)):
    uid = as_uuid(user_id)
    target = await session.get(User, uid) if uid else None
    if not target:
        raise HTTPException(404, "User not found")
    target.disabled = False
    await session.commit()
    return {"ok": True}


class SetRolesRequest(BaseModel):
    roles: List[str] = []


@api_router.post("/admin/users/{user_id}/roles")
async def admin_set_roles(user_id: str, body: SetRolesRequest,
                          admin: dict = Depends(require_role("admin")),
                          session: AsyncSession = Depends(get_session)):
    """Grant/revoke a user's capabilities (customer / clipper / admin)."""
    uid = as_uuid(user_id)
    target = await session.scalar(select(User).options(selectinload(User.roles)).where(User.id == uid)) if uid else None
    if not target:
        raise HTTPException(404, "User not found")
    wanted = {r for r in body.roles if r in ("customer", "clipper", "admin")}
    if str(target.id) == admin["id"] and "admin" not in wanted:
        raise HTTPException(400, "You cannot remove your own admin role")
    current = set(_roles_list(target))
    for r in wanted - current:
        session.add(UserRoleAssoc(user_id=target.id, role=UserRole(r)))
    for r in current - wanted:
        await session.execute(delete(UserRoleAssoc).where(
            UserRoleAssoc.user_id == target.id, UserRoleAssoc.role == UserRole(r)))
    if "clipper" in wanted:
        await _ensure_clipper_profile_row(session, target)
    await session.commit()
    return {"ok": True, "roles": sorted(wanted)}


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_role("admin")),
                            session: AsyncSession = Depends(get_session)):
    """Permanently remove a user. Only allowed when the account has no
    entangling history (owned projects, contracts, or money ledger rows) -
    those FKs are RESTRICT so the DB would refuse anyway. For accounts with
    history, suspend instead (keeps the audit trail intact)."""
    uid = as_uuid(user_id)
    target = await session.scalar(select(User).options(selectinload(User.roles))
                                  .where(User.id == uid)) if uid else None
    if not target:
        raise HTTPException(404, "User not found")
    if str(target.id) == admin["id"]:
        raise HTTPException(400, "You cannot delete your own account")
    if "admin" in _roles_list(target):
        raise HTTPException(400, "Admin accounts cannot be deleted")

    # Pre-flight so we can return a clear reason instead of a raw DB error.
    owned = await session.scalar(select(func.count()).select_from(Project).where(Project.owner_id == uid))
    as_clipper = await session.scalar(select(func.count()).select_from(Contract).where(Contract.clipper_id == uid))
    money = await session.scalar(select(func.count()).select_from(Transaction)
                                 .where(or_(Transaction.from_user == uid, Transaction.to_user == uid)))
    if owned or as_clipper or money:
        raise HTTPException(409, "This user has projects, contracts or payment history and can't be "
                                 "deleted. Suspend them instead to preserve the record.")

    name = target.name
    try:
        await session.delete(target)   # cascades bids/messages/reviews/withdrawals/roles/profile
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "This user still has linked records and can't be deleted. "
                                 "Suspend them instead.")
    return {"ok": True, "deleted": name}


@api_router.post("/admin/projects/{project_id}/fund-free")
async def admin_fund_free(project_id: str, admin: dict = Depends(require_role("admin")),
                          session: AsyncSession = Depends(get_session)):
    """Publish a job live at no charge (admin comp). Mirrors the paid-funding
    flip (funded + open) and records a comp deposit in the ledger. Idempotent via
    the deterministic, unique chain_sig."""
    pid = as_uuid(project_id)
    p = await session.get(Project, pid) if pid else None
    if not p:
        raise HTTPException(404, "Project not found")
    if p.funded:
        return {"ok": True, "already": True}
    _publish_project_free(session, p, "admin_comp")
    await session.commit()
    return {"ok": True}


class HideRequest(BaseModel):
    hidden: bool = True


@api_router.post("/admin/projects/{project_id}/hide")
async def admin_hide_project(project_id: str, body: HideRequest,
                             admin: dict = Depends(require_role("admin")),
                             session: AsyncSession = Depends(get_session)):
    """Hide/unhide a project from the public marketplace (non-destructive)."""
    pid = as_uuid(project_id)
    p = await session.get(Project, pid) if pid else None
    if not p:
        raise HTTPException(404, "Project not found")
    p.hidden = bool(body.hidden)
    await session.commit()
    return {"ok": True, "hidden": p.hidden}


@api_router.delete("/admin/projects/{project_id}")
async def admin_delete_project(project_id: str, admin: dict = Depends(require_role("admin")),
                               session: AsyncSession = Depends(get_session)):
    """Permanently delete a project (and its bids/references). Blocked when it has
    contracts or payment history - hide it instead to keep the record."""
    pid = as_uuid(project_id)
    p = await session.get(Project, pid) if pid else None
    if not p:
        raise HTTPException(404, "Project not found")
    contracts = await session.scalar(select(func.count()).select_from(Contract).where(Contract.project_id == pid))
    txns = await session.scalar(select(func.count()).select_from(Transaction).where(Transaction.project_id == pid))
    if contracts or txns:
        raise HTTPException(409, "This project has contracts or payment history and can't be deleted. "
                                 "Hide it from the public page instead.")
    title = p.title
    try:
        await session.delete(p)   # cascades bids + references
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(409, "This project has linked records and can't be deleted. Hide it instead.")
    return {"ok": True, "deleted": title}


@api_router.patch("/admin/projects/{project_id}")
async def admin_update_project(project_id: str, body: AdminProjectUpdate,
                               admin: dict = Depends(require_role("admin")),
                               session: AsyncSession = Depends(get_session)):
    """Edit a project's fields. Only supplied fields change; changing the budget
    recomputes the deadline bond."""
    pid = as_uuid(project_id)
    p = await session.scalar(select(Project).options(selectinload(Project.references))
                             .where(Project.id == pid)) if pid else None
    if not p:
        raise HTTPException(404, "Project not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    if "budget" in data and p.budget is not None:
        p.bond = bond_for(float(p.budget))
    await session.commit()
    return await serialize_project(session, p)


@api_router.get("/admin/export/{entity}.csv")
async def admin_export_csv(entity: str, admin: dict = Depends(require_role("admin")),
                           session: AsyncSession = Depends(get_session)):
    """Download users / projects / contracts / bids as CSV."""
    import csv, io
    buf = io.StringIO()
    w = csv.writer(buf)
    if entity == "users":
        w.writerow(["id", "email", "name", "roles", "auth_provider", "email_verified", "disabled", "created_at"])
        rows = await session.scalars(select(User).options(selectinload(User.roles)).order_by(User.created_at.desc()))
        for u in rows:
            w.writerow([u.id, u.email, u.name, "|".join(_roles_list(u)),
                        getattr(u.auth_provider, "value", u.auth_provider), u.email_verified,
                        u.disabled, u.created_at.isoformat() if u.created_at else ""])
    elif entity == "projects":
        w.writerow(["id", "title", "category", "budget", "status", "funded", "hidden", "owner_id", "payment_method", "created_at"])
        rows = await session.scalars(select(Project).order_by(Project.created_at.desc()))
        for p in rows:
            w.writerow([p.id, p.title, p.category, p.budget, getattr(p.status, "value", p.status),
                        p.funded, p.hidden, p.owner_id, p.payment_method or "",
                        p.created_at.isoformat() if p.created_at else ""])
    elif entity == "contracts":
        w.writerow(["id", "project_id", "clipper_id", "price", "bond", "status", "deadline_at", "created_at"])
        rows = await session.scalars(select(Contract).order_by(Contract.created_at.desc()))
        for c in rows:
            w.writerow([c.id, c.project_id, c.clipper_id, c.price, c.bond,
                        getattr(c.status, "value", c.status),
                        c.deadline_at.isoformat() if c.deadline_at else "",
                        c.created_at.isoformat() if c.created_at else ""])
    elif entity == "bids":
        w.writerow(["id", "project_id", "clipper_id", "amount", "eta_hours", "status", "created_at"])
        rows = await session.scalars(select(Bid).order_by(Bid.created_at.desc()))
        for b in rows:
            w.writerow([b.id, b.project_id, b.clipper_id, b.amount, b.eta_hours,
                        getattr(b.status, "value", b.status),
                        b.created_at.isoformat() if b.created_at else ""])
    else:
        raise HTTPException(404, "Unknown export. Use users, projects, contracts or bids.")
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="24hc-{entity}.csv"'})


# ============================ AI CONCIERGE ============================
CONCIERGE_SYSTEM = """You are the AI Clipping Concierge for 24 Hour Clipping, a marketplace where customers post short-form video clipping projects and trusted clippers deliver a first cut within 24 hours.

Your job: through a SHORT, friendly conversation (max 4-5 questions total, ONE question per message), gather what's needed for a project brief:
- What footage they have (link or upload) and whether they know the exact moment or want the clipper to find the best moment
- Project goal + target audience
- Platform (TikTok / Reels / Shorts), output length (15-90s), aspect ratio (9:16 default)
- Mood, editing style, caption preference, call to action
- Budget ($20-$500)

Rules: Be energetic and concise (2-3 sentences max per reply). Never use emojis. Ask ONE question at a time. When you have enough info, say "I have everything I need - hit Generate Brief and I'll build your one-page project brief."
"""

BRIEF_SYSTEM = """You convert a conversation into a video clipping project brief. Reply ONLY with valid JSON, no markdown fences, with exactly these keys:
{"title": str, "category": str (one of: Stream Highlights, Podcast Clips, TikToks, Reels, YouTube Shorts, Talking-Head, Short Ads), "description": str (2-3 sentences), "goal": str, "audience": str, "platform": str, "output_length": str, "aspect_ratio": str, "captions": str, "mood": str, "style": str, "cta": str, "budget": number (20-500), "moment_mode": "known" or "find", "source_link": str}
Fill sensible defaults for anything not discussed. Budget must be a number."""


async def _ai_history(session: AsyncSession, session_id: str) -> list:
    val = await _get_setting(session, f"ai:{session_id}")
    return (val or {}).get("messages", [])


async def _ai_append(session_id: str, sender: str, text: str):
    async with SessionLocal() as session:
        s = await session.get(AppSetting, f"ai:{session_id}")
        msgs = list((s.value or {}).get("messages", [])) if s else []
        msgs.append({"id": str(uuid.uuid4()), "sender": sender, "text": text, "created_at": now_iso()})
        if s:
            s.value = {"messages": msgs}
        else:
            session.add(AppSetting(key=f"ai:{session_id}", value={"messages": msgs}))
        await session.commit()


OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


def _openai_client():
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "AI features require OPENAI_API_KEY to be set in backend/.env.")
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=key)


@api_router.post("/ai/chat")
async def ai_chat(body: ChatRequest, user: dict = Depends(require_role("customer", "admin")),
                  session: AsyncSession = Depends(get_session)):
    client = _openai_client()
    history = await _ai_history(session, body.session_id)
    messages = [{"role": "system", "content": CONCIERGE_SYSTEM}]
    for m in history[-12:]:
        messages.append({"role": "assistant" if m["sender"] == "ai" else "user", "content": m["text"]})
    messages.append({"role": "user", "content": body.message})
    await _ai_append(body.session_id, "user", body.message)

    async def gen():
        full = []
        try:
            stream = await client.chat.completions.create(
                model=OPENAI_MODEL, messages=messages, stream=True, temperature=0.6)
            async for chunk in stream:
                delta = (chunk.choices[0].delta.content or "") if chunk.choices else ""
                if delta:
                    full.append(delta)
                    yield f"data: {json.dumps({'delta': delta})}\n\n"
        except Exception as e:
            logger.error(f"AI stream error: {e}")
            yield f"data: {json.dumps({'error': 'The concierge is unavailable right now.'})}\n\n"
        text = "".join(full)
        if text:
            await _ai_append(body.session_id, "ai", text)
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api_router.get("/ai/history/{session_id}")
async def ai_history(session_id: str, user: dict = Depends(require_role("customer", "admin")),
                     session: AsyncSession = Depends(get_session)):
    return await _ai_history(session, session_id)


@api_router.post("/ai/brief")
async def ai_brief(body: BriefRequest, user: dict = Depends(require_role("customer", "admin")),
                   session: AsyncSession = Depends(get_session)):
    client = _openai_client()
    history = await _ai_history(session, body.session_id)
    if not history:
        raise HTTPException(400, "No conversation found")
    convo = "\n".join(f"{m['sender']}: {m['text']}" for m in history)
    try:
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL, temperature=0.2, response_format={"type": "json_object"},
            messages=[{"role": "system", "content": BRIEF_SYSTEM},
                      {"role": "user", "content": f"Conversation:\n{convo}\n\nGenerate the brief JSON."}])
    except Exception as e:
        logger.error("AI brief error: %s", e)
        raise HTTPException(502, "Brief generation failed, please try again")
    text = (resp.choices[0].message.content or "").strip()
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
# needed - this keeps a wildcard origin valid. Lock CORS_ORIGINS to your domain
# in production for defense in depth.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================ BLOG (SEO/AEO) ============================
async def _platform_stats(session: AsyncSession) -> dict:
    """Real, current numbers to season the auto-generated articles with."""
    clippers = await session.scalar(select(func.count()).select_from(ClipperProfile)) or 0
    open_jobs = await session.scalar(select(func.count()).select_from(Project).where(Project.status == ProjectStatus.open)) or 0
    total_jobs = await session.scalar(select(func.count()).select_from(Project)) or 0
    avg_budget = await session.scalar(select(func.avg(Project.budget)))
    completed = await session.scalar(select(func.count()).select_from(Contract).where(Contract.status == ContractStatus.completed)) or 0
    return {
        "vetted clippers on the platform": int(clippers) or None,
        "open jobs right now": int(open_jobs) or None,
        "total jobs posted": int(total_jobs) or None,
        "average job budget (USD)": round(float(avg_budget)) if avg_budget else None,
        "clips completed": int(completed) or None,
        "turnaround guarantee": "24 hours",
        "platform fee": "8% on approval",
    }


async def _generate_and_store_post(session: AsyncSession):
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        logger.info("blog: OPENAI_API_KEY unset, skipping generation")
        return None
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=key)
    count = await session.scalar(select(func.count()).select_from(BlogPost)) or 0
    topic = blog.pick_topic(count, datetime.now(timezone.utc).year)
    stats = await _platform_stats(session)
    try:
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL, temperature=0.7,
            response_format={"type": "json_object"},
            messages=blog.build_messages(topic, stats))
        data = json.loads(resp.choices[0].message.content or "{}")
    except Exception as e:
        logger.error("blog generation failed: %s", e)
        return None
    title = (data.get("title") or topic).strip()[:140]
    body_html = blog.sanitize_html(data.get("body_html") or "")
    if not body_html or len(body_html) < 200:
        logger.warning("blog: generated body too short, skipping")
        return None
    base_slug = blog.slugify(data.get("slug") or title)
    slug, n = base_slug, 1
    while await session.scalar(select(BlogPost.id).where(BlogPost.slug == slug)):
        n += 1
        slug = f"{base_slug}-{n}"
    post = BlogPost(
        slug=slug, title=title,
        description=(data.get("description") or "").strip()[:300],
        keywords=(data.get("keywords") or "").strip()[:400],
        category=(data.get("category") or "Insights").strip()[:60],
        body_html=body_html, read_minutes=blog.read_minutes(body_html), source="ai",
    )
    session.add(post)
    await session.commit()
    logger.info("blog: generated post '%s'", slug)
    return post


async def _seed_blog_if_empty(session: AsyncSession):
    if (await session.scalar(select(func.count()).select_from(BlogPost)) or 0):
        return
    seeds = blog.seed_posts()
    for i, s in enumerate(seeds):
        session.add(BlogPost(
            slug=s["slug"], title=s["title"], description=s["description"],
            keywords=s["keywords"], category=s["category"],
            body_html=blog.sanitize_html(s["body_html"]),
            read_minutes=blog.read_minutes(s["body_html"]), source="seed",
            published_at=datetime.now(timezone.utc) - timedelta(days=i),
        ))
    await session.commit()
    logger.info("blog: seeded %d posts", len(seeds))


async def _blog_scheduler():
    """Daily-ish autogen: if nothing published in ~20h, generate a fresh post.
    DB-gated so it's idempotent across restarts (single uvicorn worker)."""
    await asyncio.sleep(90)  # let startup settle
    while True:
        try:
            async with SessionLocal() as session:
                last = await session.scalar(select(func.max(BlogPost.published_at)))
                now = datetime.now(timezone.utc)
                if last is None or (now - last) > timedelta(hours=20):
                    await _generate_and_store_post(session)
        except Exception as e:
            logger.error("blog scheduler error: %s", e)
        await asyncio.sleep(3 * 3600)


@app.get("/blog", response_class=HTMLResponse)
async def blog_index(session: AsyncSession = Depends(get_session)):
    posts = (await session.scalars(
        select(BlogPost).order_by(BlogPost.published_at.desc()).limit(60))).all()
    return HTMLResponse(blog.render_index(posts))


@app.get("/blog/sitemap.xml")
async def blog_sitemap(session: AsyncSession = Depends(get_session)):
    posts = (await session.scalars(
        select(BlogPost).order_by(BlogPost.published_at.desc()))).all()
    return Response(content=blog.render_sitemap(posts), media_type="application/xml")


@app.get("/blog/{slug}", response_class=HTMLResponse)
async def blog_article(slug: str, session: AsyncSession = Depends(get_session)):
    post = await session.scalar(select(BlogPost).where(BlogPost.slug == slug))
    if not post:
        return HTMLResponse("<h1>Post not found</h1><p><a href=\"/blog\">Back to the blog</a></p>", status_code=404)
    recent = (await session.scalars(
        select(BlogPost).order_by(BlogPost.published_at.desc()).limit(6))).all()
    return HTMLResponse(blog.render_article(post, recent))


# Registered on `app` (not api_router) because this block is defined after
# app.include_router(api_router); the /api path is kept for consistency.
@app.post("/api/admin/blog/generate")
async def admin_blog_generate(admin: dict = Depends(require_role("admin")),
                              session: AsyncSession = Depends(get_session)):
    post = await _generate_and_store_post(session)
    if not post:
        raise HTTPException(503, "Could not generate a post (check OPENAI_API_KEY).")
    return {"ok": True, "slug": post.slug, "title": post.title}


@app.on_event("startup")
async def startup():
    storage.ensure_root()
    await init_db()
    await ensure_auth_setup()
    async with SessionLocal() as session:
        try:
            await _seed_blog_if_empty(session)
        except Exception as e:
            logger.error("blog seed error: %s", e)
    if os.environ.get("BLOG_AUTOGEN", "true").lower() != "false":
        asyncio.create_task(_blog_scheduler())


@app.on_event("shutdown")
async def shutdown_db_client():
    await engine.dispose()
