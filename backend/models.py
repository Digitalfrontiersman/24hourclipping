"""SQLAlchemy 2.0 ORM models — the target PostgreSQL schema.

Mirrors docs/DB-SCHEMA.md. Money is NUMERIC (never float); every relationship is a
real foreign key; status columns are enums; illegal states are blocked by unique
indexes and check constraints so the database enforces the marketplace's invariants.
"""
import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    String, Text, Boolean, Integer, SmallInteger, Numeric, ForeignKey,
    DateTime, Enum as SAEnum, UniqueConstraint, CheckConstraint, Index, func, text,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ----------------------------- enums -----------------------------
class AuthProvider(str, enum.Enum):
    local = "local"; google = "google"; demo = "demo"

class UserRole(str, enum.Enum):
    customer = "customer"; clipper = "clipper"; admin = "admin"

class ProjectStatus(str, enum.Enum):
    draft = "draft"; open = "open"; contract_live = "contract_live"
    delivered = "delivered"; completed = "completed"; rescue = "rescue"; closed = "closed"

class BidStatus(str, enum.Enum):
    pending = "pending"; accepted = "accepted"; rejected = "rejected"; withdrawn = "withdrawn"

class ContractStatus(str, enum.Enum):
    live = "live"; delivered = "delivered"; revision = "revision"
    completed = "completed"; rescue = "rescue"; closed_rescued = "closed_rescued"

class Currency(str, enum.Enum):
    usd = "usd"; usdc = "usdc"; sol = "sol"

class TxnKind(str, enum.Enum):
    deposit = "deposit"; payout = "payout"; tip = "tip"
    bond_hold = "bond_hold"; bond_release = "bond_release"; bond_forfeit = "bond_forfeit"; fee = "fee"

class TxnStatus(str, enum.Enum):
    pending = "pending"; confirmed = "confirmed"; failed = "failed"

class WithdrawalStatus(str, enum.Enum):
    pending = "pending"; paid = "paid"; failed = "failed"


# ----------------------------- helpers -----------------------------
def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

def _created() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

def _updated() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# ----------------------------- identity -----------------------------
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = _pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(Text)
    auth_provider: Mapped[AuthProvider] = mapped_column(SAEnum(AuthProvider, name="auth_provider"), default=AuthProvider.local, server_default=text("'local'"), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    credits: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"), nullable=False)
    payout_wallet: Mapped[str | None] = mapped_column(Text)   # Solana wallet (legacy USDC rail)
    paypal_email: Mapped[str | None] = mapped_column(Text)    # PayPal payout destination
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)
    # Defaults TRUE so existing accounts and OAuth (Google) users are verified;
    # new local (email/password) signups are inserted as False until they confirm.
    email_verified: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"), nullable=False)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    roles: Mapped[list["UserRoleAssoc"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    clipper_profile: Mapped["ClipperProfile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    __table_args__ = (CheckConstraint("credits >= 0", name="ck_users_credits_nonneg"),)


class UserRoleAssoc(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), primary_key=True)


class ClipperProfile(Base):
    __tablename__ = "clipper_profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    handle: Mapped[str | None] = mapped_column(String(80), unique=True)
    specialty: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    price_min: Mapped[float | None] = mapped_column(Numeric(14, 2))
    price_max: Mapped[float | None] = mapped_column(Numeric(14, 2))
    badge: Mapped[str | None] = mapped_column(Text)
    tools: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default=text("'{}'"), nullable=False)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0, server_default=text("0"), nullable=False)
    on_time_pct: Mapped[int] = mapped_column(SmallInteger, default=100, server_default=text("100"), nullable=False)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"), nullable=False)
    missed_deadlines: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"), nullable=False)
    status: Mapped[str] = mapped_column(Text, default="approved", server_default=text("'approved'"), nullable=False)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    user: Mapped["User"] = relationship(back_populates="clipper_profile")
    portfolio: Mapped[list["PortfolioItem"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id: Mapped[uuid.UUID] = _pk()
    clipper_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clipper_profiles.user_id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None] = mapped_column(Text)
    thumb_url: Mapped[str | None] = mapped_column(Text)
    video_url: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)


class BrandProfile(Base):
    __tablename__ = "brand_profiles"
    id: Mapped[uuid.UUID] = _pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str | None] = mapped_column(Text)
    caption_style: Mapped[str | None] = mapped_column(Text)
    pacing: Mapped[str | None] = mapped_column(Text)
    cta: Mapped[str | None] = mapped_column(Text)
    avoid: Mapped[str | None] = mapped_column(Text)
    fonts: Mapped[str | None] = mapped_column(Text)
    colors: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default=text("'{}'"), nullable=False)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()


# ----------------------------- marketplace -----------------------------
class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = _pk()
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="", server_default=text("''"), nullable=False)
    budget: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    bond: Mapped[float] = mapped_column(Numeric(14, 2), default=0, server_default=text("0"), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(SAEnum(ProjectStatus, name="project_status"), default=ProjectStatus.draft, server_default=text("'draft'"), nullable=False, index=True)
    funded: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)
    output_length: Mapped[str | None] = mapped_column(Text)
    aspect_ratio: Mapped[str | None] = mapped_column(Text)
    captions: Mapped[str | None] = mapped_column(Text)
    platform: Mapped[str | None] = mapped_column(Text)
    moment_mode: Mapped[str | None] = mapped_column(Text)
    goal: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str | None] = mapped_column(Text)
    mood: Mapped[str | None] = mapped_column(Text)
    style: Mapped[str | None] = mapped_column(Text)
    cta: Mapped[str | None] = mapped_column(Text)
    source_link: Mapped[str | None] = mapped_column(Text)
    source_key: Mapped[str | None] = mapped_column(Text)
    source_length: Mapped[str | None] = mapped_column(Text)
    thumbnail_url: Mapped[str | None] = mapped_column(Text)
    thumbnail_key: Mapped[str | None] = mapped_column(Text)
    quality_notes: Mapped[str | None] = mapped_column(Text)
    deadline_hours: Mapped[int] = mapped_column(SmallInteger, default=24, server_default=text("24"), nullable=False)
    allow_extension: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)
    payment_method: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at: Mapped[datetime] = _updated()

    references: Mapped[list["ProjectReference"]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    __table_args__ = (
        CheckConstraint("budget > 0", name="ck_projects_budget_pos"),
        CheckConstraint("deadline_hours BETWEEN 1 AND 168", name="ck_projects_deadline"),
    )


class ProjectReference(Base):
    __tablename__ = "project_references"
    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)


class Bid(Base):
    __tablename__ = "bids"
    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    clipper_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    pitch: Mapped[str] = mapped_column(Text, nullable=False)
    eta_hours: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    bond_required: Mapped[float] = mapped_column(Numeric(14, 2), default=0, server_default=text("0"), nullable=False)
    status: Mapped[BidStatus] = mapped_column(SAEnum(BidStatus, name="bid_status"), default=BidStatus.pending, server_default=text("'pending'"), nullable=False)
    created_at: Mapped[datetime] = _created()
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_bids_amount_pos"),
        CheckConstraint("eta_hours BETWEEN 1 AND 72", name="ck_bids_eta"),
        # one pending bid per clipper per project (partial unique)
        Index("uq_one_pending_bid", "project_id", "clipper_id",
              unique=True, postgresql_where=(status == BidStatus.pending)),
    )


class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[uuid.UUID] = _pk()
    bid_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bids.id", ondelete="RESTRICT"), unique=True, nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    clipper_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    bond: Mapped[float] = mapped_column(Numeric(14, 2), default=0, server_default=text("0"), nullable=False)
    status: Mapped[ContractStatus] = mapped_column(SAEnum(ContractStatus, name="contract_status"), default=ContractStatus.live, server_default=text("'live'"), nullable=False, index=True)
    base_hours: Mapped[int] = mapped_column(SmallInteger, default=24, server_default=text("24"), nullable=False)
    extended_hours: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"), nullable=False)
    allow_extension: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    rating_given: Mapped[int | None] = mapped_column(SmallInteger)
    payment_method: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _created()
    updated_at: Mapped[datetime] = _updated()

    deliveries: Mapped[list["Delivery"]] = relationship(cascade="all, delete-orphan", lazy="selectin", order_by="Delivery.version")
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_contracts_price_pos"),
        CheckConstraint("extended_hours BETWEEN 0 AND 48", name="ck_contracts_ext"),
        CheckConstraint("rating_given IS NULL OR rating_given BETWEEN 1 AND 5", name="ck_contracts_rating"),
    )


class Delivery(Base):
    __tablename__ = "deliveries"
    id: Mapped[uuid.UUID] = _pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    url: Mapped[str | None] = mapped_column(Text)
    object_key: Mapped[str | None] = mapped_column(Text)
    thumb_url: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = _created()
    __table_args__ = (UniqueConstraint("contract_id", "version", name="uq_delivery_version"),)


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[uuid.UUID] = _pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), unique=True)
    clipper_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    text: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _created()
    __table_args__ = (CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating"),)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = _pk()
    contract_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"))
    bid_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("bids.id", ondelete="CASCADE"))
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    sender_role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role", create_type=False))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = _created()
    __table_args__ = (
        CheckConstraint("num_nonnulls(contract_id, bid_id) = 1", name="ck_message_one_thread"),
        Index("ix_messages_contract", "contract_id", "created_at"),
        Index("ix_messages_bid", "bid_id", "created_at"),
    )


class Transaction(Base):
    """Immutable ledger — one row per money movement (deposit/payout/tip/bond/fee)."""
    __tablename__ = "transactions"
    id: Mapped[uuid.UUID] = _pk()
    kind: Mapped[TxnKind] = mapped_column(SAEnum(TxnKind, name="txn_kind"), nullable=False)
    status: Mapped[TxnStatus] = mapped_column(SAEnum(TxnStatus, name="txn_status"), default=TxnStatus.pending, server_default=text("'pending'"), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id"), index=True)
    contract_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("contracts.id"), index=True)
    from_user: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    to_user: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[int] = mapped_column(Numeric(20, 0), nullable=False)  # base units
    currency: Mapped[Currency] = mapped_column(SAEnum(Currency, name="currency"), nullable=False)
    chain_sig: Mapped[str | None] = mapped_column(Text, unique=True)  # anti-replay
    meta: Mapped[dict] = mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"), nullable=False)
    created_at: Mapped[datetime] = _created()


class Withdrawal(Base):
    """A clipper cashing out their accrued balance on a payout rail."""
    __tablename__ = "withdrawals"
    id: Mapped[uuid.UUID] = _pk()
    clipper_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Numeric(20, 0), nullable=False)  # base units (usd cents)
    currency: Mapped[Currency] = mapped_column(SAEnum(Currency, name="currency", create_type=False), server_default=text("'usd'"), nullable=False)
    method: Mapped[str] = mapped_column(Text, nullable=False)          # "usdc" | "paypal" | ...
    destination: Mapped[str | None] = mapped_column(Text)              # wallet address / paypal email
    status: Mapped[WithdrawalStatus] = mapped_column(SAEnum(WithdrawalStatus, name="withdrawal_status"), default=WithdrawalStatus.pending, server_default=text("'pending'"), nullable=False)
    chain_sig: Mapped[str | None] = mapped_column(Text, unique=True)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _created()
    __table_args__ = (CheckConstraint("amount > 0", name="ck_withdrawal_amount_pos"),)


class AppSetting(Base):
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(Text, primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
