// LIVE BID SIMULATION - in demo/test mode, populate a project's bid room with
// realistic bids (server-side, from seed clippers) and reveal them one-by-one
// so the room feels alive. Falls back gracefully outside test mode.
import { dbAdapter, bondFor } from "./dbAdapter";

export const realtimeAdapter = {
  // Populates + streams in demo bids for a project. Returns an unsubscribe fn.
  subscribeToBids(project, existingClipperIds, onBid) {
    let stopped = false;
    const timers = [];
    dbAdapter
      .seedDemoBids(project.id)
      .then((newBids) => {
        if (stopped || !Array.isArray(newBids)) return;
        newBids.forEach((bid, i) => {
          const t = setTimeout(() => { if (!stopped) onBid(bid); }, 1400 + i * 2400);
          timers.push(t);
        });
      })
      .catch(() => { /* not in test mode / not owner - no simulated bids */ });
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
    };
  },
};

export { bondFor };
