// MOCK PAYMENT ADAPTER — simulates USDC-on-Solana and card payments.
// Replace with Stripe / Solana Pay integration later. No real funds move.
import { dbAdapter } from "./dbAdapter";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const paymentAdapter = {
  async fund(projectId, method) {
    await delay(1600);
    return dbAdapter.fundProject(projectId, method);
  },
  successFee: (price) => Math.round(price * 0.08 * 100) / 100,
  payout: (price) => Math.round(price * 0.92 * 100) / 100,
};
