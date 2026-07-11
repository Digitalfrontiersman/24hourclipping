// MOCK SOLANA ADAPTER — simulated wallet + explorer links. No real keys or contracts.
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const solanaAdapter = {
  async connectWallet() {
    await delay(1200);
    const addr = "7xKX" + Math.random().toString(36).slice(2, 10) + "…" + Math.random().toString(36).slice(2, 6);
    localStorage.setItem("24hc_wallet", addr);
    return addr;
  },
  getWallet: () => localStorage.getItem("24hc_wallet"),
  explorerUrl: (tx) => `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
};
