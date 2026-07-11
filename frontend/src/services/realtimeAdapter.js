// MOCK REAL-TIME ADAPTER — simulates live bid arrivals. Replace with WebSockets later.
import { dbAdapter, bondFor } from "./dbAdapter";

const PITCHES = [
  "Hook locked in the first 1.5 seconds. Let's go.",
  "This is exactly my lane — check my last three clips.",
  "I can start right now. First cut well under deadline.",
  "Punch-ins, sound design, captions on point. Done it 200 times.",
  "Your audience will not scroll past this. Guaranteed pacing.",
];

export const realtimeAdapter = {
  // Simulates incoming bids for a project. Returns an unsubscribe fn.
  subscribeToBids(project, existingClipperIds, onBid) {
    let stopped = false;
    let pool = [];
    dbAdapter.getClippers().then((cs) => {
      pool = cs.filter((c) => !existingClipperIds.includes(c.id));
    });
    const spawn = () => {
      if (stopped || pool.length === 0) return;
      const clipper = pool.shift();
      const amount = Math.max(20, Math.round(project.budget * (0.75 + Math.random() * 0.35)));
      dbAdapter
        .createBid(project.id, {
          clipper_id: clipper.id,
          amount,
          pitch: PITCHES[Math.floor(Math.random() * PITCHES.length)],
          eta_hours: 6 + Math.floor(Math.random() * 14),
        })
        .then(onBid)
        .catch(() => {});
      if (!stopped && pool.length) timer = setTimeout(spawn, 5000 + Math.random() * 6000);
    };
    let timer = setTimeout(spawn, 3500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  },
};

export { bondFor };
