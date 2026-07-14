// LIVE BIDS - polls the real bids endpoint so the bid room updates on its own
// as clippers bid, without a websocket layer. The first pass "primes" the set of
// bids already on screen (no notification), then every poll emits only genuinely
// new bids. Stops when the caller unsubscribes (e.g. project no longer open).
import { dbAdapter, bondFor } from "./dbAdapter";

const POLL_MS = 4000;

export const realtimeAdapter = {
  // Streams in new bids for a project. Returns an unsubscribe fn.
  subscribeToBids(project, _existing, onBid) {
    let stopped = false;
    let primed = false;
    const seen = new Set();

    const poll = async () => {
      if (stopped) return;
      try {
        const bids = await dbAdapter.getBids(project.id);
        if (stopped || !Array.isArray(bids)) return;
        for (const b of bids) {
          if (seen.has(b.id)) continue;
          seen.add(b.id);
          if (primed) onBid(b); // only surface bids that arrived after we started
        }
        primed = true;
      } catch {
        /* transient error - try again next tick */
      }
    };

    poll(); // prime immediately (silently records what's already there)
    const interval = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(interval); };
  },
};

export { bondFor };
