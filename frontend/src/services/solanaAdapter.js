// REAL SOLANA ADAPTER - Phantom wallet + USDC (SPL token) transfers on mainnet.
// The backend verifies every transfer on-chain; this only builds/sends from the
// user's own wallet. No secret keys live in the frontend.
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

// Public RPC for the two read calls the client makes (blockhash + confirm).
// The secret Helius endpoint stays server-side; this can be overridden at build time.
const RPC = process.env.REACT_APP_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const USDC_DECIMALS = 6;

function getProvider() {
  if (typeof window === "undefined") return null;
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
}

export const solanaAdapter = {
  isInstalled: () => !!getProvider(),

  async connect() {
    const provider = getProvider();
    if (!provider) {
      throw new Error("Phantom wallet not found - install it from phantom.app");
    }
    const res = await provider.connect();
    return res.publicKey.toString();
  },

  getWallet() {
    const p = getProvider();
    return p?.publicKey ? p.publicKey.toString() : null;
  },

  // Transfer `amountUsd` USDC from the connected wallet to `toAddress`.
  // Returns the confirmed transaction signature.
  async sendUsdc({ toAddress, amountUsd, mint }) {
    const provider = getProvider();
    if (!provider) throw new Error("Phantom wallet not found");
    const from = (await provider.connect()).publicKey;
    const conn = new Connection(RPC, "confirmed");

    const mintPk = new PublicKey(mint);
    const toPk = new PublicKey(toAddress);
    const amount = BigInt(Math.round(Number(amountUsd) * 10 ** USDC_DECIMALS));
    if (amount <= 0n) throw new Error("Amount must be greater than zero");

    const fromAta = await getAssociatedTokenAddress(mintPk, from);
    const toAta = await getAssociatedTokenAddress(mintPk, toPk);

    const tx = new Transaction();
    // Creates the recipient's USDC account only if it doesn't exist yet (idempotent).
    tx.add(createAssociatedTokenAccountIdempotentInstruction(from, toAta, toPk, mintPk));
    tx.add(createTransferCheckedInstruction(fromAta, mintPk, toAta, from, amount, USDC_DECIMALS));

    tx.feePayer = from;
    const latest = await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;

    const { signature } = await provider.signAndSendTransaction(tx);
    await conn.confirmTransaction(
      { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed"
    );
    return signature;
  },

  // Transfer native SOL from the connected wallet to `toAddress`. Returns the signature.
  async sendSol({ toAddress, amountSol }) {
    const provider = getProvider();
    if (!provider) throw new Error("Phantom wallet not found");
    const from = (await provider.connect()).publicKey;
    const conn = new Connection(RPC, "confirmed");
    const toPk = new PublicKey(toAddress);
    const lamports = Math.round(Number(amountSol) * LAMPORTS_PER_SOL);
    if (lamports <= 0) throw new Error("Amount must be greater than zero");

    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: toPk, lamports }));
    tx.feePayer = from;
    const latest = await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;

    const { signature } = await provider.signAndSendTransaction(tx);
    await conn.confirmTransaction(
      { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed"
    );
    return signature;
  },

  explorerUrl: (sig) => `https://solscan.io/tx/${sig}`,
};
