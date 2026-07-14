"""Solana USDC payments: creator deposits into a platform treasury (escrow),
clippers are paid out on approval (platform keeps a fee), and creators can tip
clippers directly (no fee).

Custodial model: the treasury keypair lives on the server. USDC has 6 decimals.
All on-chain reads/sends go through a configured RPC (Helius on mainnet).

Env:
  SOLANA_RPC_URL       full RPC endpoint (required to enable the feature)
  SOLANA_NETWORK       "mainnet" | "devnet"  (default mainnet)
  SOLANA_TREASURY_SECRET  base58 secret key of the treasury wallet
  SOLANA_USDC_MINT     override mint (defaults per network)
  PLATFORM_FEE_PCT     clipper-payout fee, percent (default 8)
"""
import os
import logging

logger = logging.getLogger("solana_pay")

RPC_URL = os.environ.get("SOLANA_RPC_URL", "").strip()
NETWORK = os.environ.get("SOLANA_NETWORK", "mainnet").strip().lower()
TREASURY_SECRET = os.environ.get("SOLANA_TREASURY_SECRET", "").strip()
FEE_PCT = float(os.environ.get("PLATFORM_FEE_PCT", "8"))

# Circle USDC mints
_DEFAULT_MINT = {
    "mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
}
USDC_MINT_STR = os.environ.get("SOLANA_USDC_MINT", "").strip() or _DEFAULT_MINT.get(NETWORK, _DEFAULT_MINT["mainnet"])
DECIMALS = 6


def is_configured() -> bool:
    return bool(RPC_URL and TREASURY_SECRET)


def _to_base(amount_usd: float) -> int:
    """USD/USDC float -> integer base units (6 decimals), rounded."""
    return int(round(float(amount_usd) * (10 ** DECIMALS)))


def _from_base(units) -> float:
    return int(units) / (10 ** DECIMALS)


# ---- lazy solana imports (feature is optional; keep the app importable without deps) ----
def _sol():
    from solana.rpc.api import Client
    from solana.rpc.types import TxOpts
    from solana.rpc.commitment import Confirmed
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.transaction import Transaction
    from solders.signature import Signature
    from spl.token.instructions import (
        get_associated_token_address, transfer_checked, TransferCheckedParams,
        create_idempotent_associated_token_account,
    )
    from spl.token.constants import TOKEN_PROGRAM_ID
    return locals()


def _client(s):
    return s["Client"](RPC_URL)


def _treasury(s):
    return s["Keypair"].from_base58_string(TREASURY_SECRET)


def treasury_pubkey() -> str:
    s = _sol()
    return str(_treasury(s).pubkey())


def config_public() -> dict:
    """Non-secret config the frontend needs to build a deposit transfer."""
    out = {"configured": is_configured(), "network": NETWORK,
           "usdc_mint": USDC_MINT_STR, "fee_pct": FEE_PCT, "decimals": DECIMALS}
    if is_configured():
        try:
            out["treasury"] = treasury_pubkey()
        except Exception as e:
            logger.error("treasury pubkey error: %s", e)
            out["configured"] = False
    return out


class PaymentError(Exception):
    pass


def _get_tx(s, signature_str):
    sig = s["Signature"].from_string(signature_str)
    resp = s["Client"](RPC_URL).get_transaction(
        sig, encoding="jsonParsed", max_supported_transaction_version=0)
    return resp.value


def _usdc_delta(meta, owner_str: str) -> float:
    """Net USDC change for `owner` in a transaction (post - pre, base units -> USDC).
    Keyed by string to be robust to Pubkey vs str in the RPC response."""
    def key(b):
        return (str(b.owner), str(b.mint))
    pre = {key(b): int(b.ui_token_amount.amount) for b in (meta.pre_token_balances or [])}
    post = {key(b): int(b.ui_token_amount.amount) for b in (meta.post_token_balances or [])}
    k = (str(owner_str), USDC_MINT_STR)
    return _from_base(post.get(k, 0) - pre.get(k, 0))


def verify_incoming(signature_str: str, dest_owner: str, expected_amount: float,
                    tolerance: float = 0.01) -> float:
    """Confirm a settled tx credited >= expected_amount USDC to `dest_owner`.
    Returns the actual amount received. Raises PaymentError otherwise."""
    s = _sol()
    try:
        tx = _get_tx(s, signature_str)
    except Exception as e:
        raise PaymentError(f"could not fetch transaction: {e}")
    if tx is None:
        raise PaymentError("transaction not found or not yet confirmed")
    meta = tx.transaction.meta
    if meta is None:
        raise PaymentError("transaction metadata unavailable")
    if meta.err is not None:
        raise PaymentError("transaction failed on-chain")
    received = _usdc_delta(meta, dest_owner)
    if received + tolerance < float(expected_amount):
        raise PaymentError(
            f"insufficient USDC received: got {received}, expected {expected_amount}")
    return received


# ---- native SOL (9 decimals / lamports) ----
LAMPORTS = 10 ** 9


def get_sol_price_usd() -> float:
    """Live SOL/USD (CoinGecko)."""
    import requests
    try:
        r = requests.get("https://api.coingecko.com/api/v3/simple/price",
                         params={"ids": "solana", "vs_currencies": "usd"}, timeout=8)
        r.raise_for_status()
        return float(r.json()["solana"]["usd"])
    except Exception as e:
        raise PaymentError(f"could not fetch SOL price: {e}")


def usd_to_sol(usd: float, price: float = None) -> float:
    price = price or get_sol_price_usd()
    return round(float(usd) / price, 6)


def _sol_delta(tx, owner_str: str) -> float:
    """Net native-SOL change (lamports -> SOL) for `owner` in a transaction."""
    meta = tx.transaction.meta
    msg = tx.transaction.transaction.message
    keys = [str(getattr(k, "pubkey", k)) for k in msg.account_keys]
    if owner_str not in keys:
        return 0.0
    i = keys.index(owner_str)
    return (meta.post_balances[i] - meta.pre_balances[i]) / LAMPORTS


def verify_incoming_sol(signature_str: str, dest_owner: str, expected_amount: float,
                        tolerance: float = None) -> float:
    """Confirm a settled tx credited ~expected_amount native SOL to `dest_owner`."""
    s = _sol()
    try:
        tx = _get_tx(s, signature_str)
    except Exception as e:
        raise PaymentError(f"could not fetch transaction: {e}")
    if tx is None:
        raise PaymentError("transaction not found or not yet confirmed")
    meta = tx.transaction.meta
    if meta is None:
        raise PaymentError("transaction metadata unavailable")
    if meta.err is not None:
        raise PaymentError("transaction failed on-chain")
    received = _sol_delta(tx, dest_owner)
    # SOL price drifts between quote and settle - allow 5% + dust slippage.
    tol = tolerance if tolerance is not None else max(0.001, float(expected_amount) * 0.05)
    if received + tol < float(expected_amount):
        raise PaymentError(f"insufficient SOL received: got {received}, expected {expected_amount}")
    return received


def send_sol(dest_wallet: str, amount_sol: float) -> str:
    """Send native SOL from the treasury to `dest_wallet`. Returns the tx signature."""
    if not is_configured():
        raise PaymentError("Solana payouts are not configured")
    if not is_valid_pubkey(dest_wallet):
        raise PaymentError("invalid destination wallet")
    lamports = int(round(float(amount_sol) * LAMPORTS))
    if lamports <= 0:
        raise PaymentError("amount must be positive")
    s = _sol()
    from solders.system_program import transfer, TransferParams
    client = _client(s)
    treasury = _treasury(s)
    dest = s["Pubkey"].from_string(dest_wallet)
    ix = transfer(TransferParams(from_pubkey=treasury.pubkey(), to_pubkey=dest, lamports=lamports))
    blockhash = client.get_latest_blockhash().value.blockhash
    tx = s["Transaction"].new_signed_with_payer([ix], treasury.pubkey(), [treasury], blockhash)
    resp = client.send_transaction(
        tx, opts=s["TxOpts"](skip_preflight=False, preflight_commitment=s["Confirmed"]))
    sig = str(resp.value)
    client.confirm_transaction(resp.value, commitment=s["Confirmed"])
    logger.info("SOL payout sent: %s SOL -> %s (%s)", amount_sol, dest_wallet, sig)
    return sig


# ---- currency-aware entry points (currency: "usdc" | "sol") ----
def verify_deposit(signature_str: str, budget_usd: float, currency: str = "usdc") -> dict:
    """Creator -> treasury escrow deposit. Returns {currency, received, usd_value}."""
    if currency == "sol":
        price = get_sol_price_usd()
        expected_sol = round(float(budget_usd) / price, 6)
        received = verify_incoming_sol(signature_str, treasury_pubkey(), expected_sol)
        return {"currency": "sol", "received": received, "usd_value": round(received * price, 2)}
    received = verify_incoming(signature_str, treasury_pubkey(), float(budget_usd))
    return {"currency": "usdc", "received": received, "usd_value": received}


def verify_tip(signature_str: str, clipper_wallet: str, expected_amount: float,
               currency: str = "usdc") -> float:
    """Creator -> clipper direct tip (no treasury involvement)."""
    if currency == "sol":
        return verify_incoming_sol(signature_str, clipper_wallet, float(expected_amount))
    return verify_incoming(signature_str, clipper_wallet, float(expected_amount))


def send_payout(dest_wallet: str, amount_usd: float, currency: str = "usdc") -> dict:
    """Pay a clipper in the same currency the project was funded in."""
    if currency == "sol":
        sol_amount = usd_to_sol(amount_usd)
        sig = send_sol(dest_wallet, sol_amount)
        return {"signature": sig, "currency": "sol", "amount": sol_amount}
    sig = send_usdc(dest_wallet, amount_usd)
    return {"signature": sig, "currency": "usdc", "amount": round(float(amount_usd), 2)}


def is_valid_pubkey(addr: str) -> bool:
    try:
        from solders.pubkey import Pubkey
        Pubkey.from_string((addr or "").strip())
        return True
    except Exception:
        return False


def send_usdc(dest_wallet: str, amount_usd: float) -> str:
    """Send USDC from the treasury to `dest_wallet`. Creates the destination
    token account if needed (treasury pays the rent). Returns the tx signature."""
    if not is_configured():
        raise PaymentError("Solana payouts are not configured")
    if not is_valid_pubkey(dest_wallet):
        raise PaymentError("invalid destination wallet")
    amount_base = _to_base(amount_usd)
    if amount_base <= 0:
        raise PaymentError("amount must be positive")

    s = _sol()
    client = _client(s)
    treasury = _treasury(s)
    Pubkey = s["Pubkey"]
    mint = Pubkey.from_string(USDC_MINT_STR)
    dest = Pubkey.from_string(dest_wallet)
    src_ata = s["get_associated_token_address"](treasury.pubkey(), mint)
    dst_ata = s["get_associated_token_address"](dest, mint)

    ixs = []
    # Create the recipient's USDC account if it doesn't exist yet (idempotent).
    if client.get_account_info(dst_ata).value is None:
        ixs.append(s["create_idempotent_associated_token_account"](
            payer=treasury.pubkey(), owner=dest, mint=mint))
    ixs.append(s["transfer_checked"](s["TransferCheckedParams"](
        program_id=s["TOKEN_PROGRAM_ID"], source=src_ata, mint=mint, dest=dst_ata,
        owner=treasury.pubkey(), amount=amount_base, decimals=DECIMALS, signers=[])))

    blockhash = client.get_latest_blockhash().value.blockhash
    tx = s["Transaction"].new_signed_with_payer(
        ixs, treasury.pubkey(), [treasury], blockhash)
    resp = client.send_transaction(
        tx, opts=s["TxOpts"](skip_preflight=False, preflight_commitment=s["Confirmed"]))
    sig = str(resp.value)
    client.confirm_transaction(resp.value, commitment=s["Confirmed"])
    logger.info("USDC payout sent: %s USDC -> %s (%s)", amount_usd, dest_wallet, sig)
    return sig


def payout_split(price: float) -> dict:
    """Given a contract price, how much the clipper gets vs the platform fee."""
    fee = round(float(price) * FEE_PCT / 100.0, 2)
    return {"clipper": round(float(price) - fee, 2), "fee": fee, "fee_pct": FEE_PCT}
