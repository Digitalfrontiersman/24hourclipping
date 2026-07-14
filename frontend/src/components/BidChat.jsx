import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dbAdapter } from "@/services/dbAdapter";
import { Send } from "lucide-react";

// Pre-acceptance chat between a creator and a bidding clipper (keyed by bid).
// `meSender` is "customer" (creator) or "clipper" - decides bubble alignment.
export default function BidChat({ bidId, meSender, otherName }) {
  const [msgs, setMsgs] = useState([]);
  const [pending, setPending] = useState([]); // optimistic, not yet confirmed
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const load = useCallback(() => {
    if (!bidId) return;
    dbAdapter.getBidMessages(bidId)
      .then((server) => {
        setMsgs(server);
        // Drop optimistic messages the server has now echoed back.
        setPending((p) => p.filter((tmp) => !server.some((s) => s.sender === tmp.sender && s.text === tmp.text)));
      })
      .catch(() => {});
  }, [bidId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const all = [...msgs, ...pending];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [all.length]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const tmp = { id: `tmp-${Date.now()}`, sender: meSender, text: t, _pending: true };
    setPending((p) => [...p, tmp]);       // show instantly
    setText("");
    try {
      await dbAdapter.sendBidMessage(bidId, t);
      load();                              // reconcile (removes the tmp)
    } catch {
      setPending((p) => p.filter((m) => m.id !== tmp.id)); // roll back on failure
    }
  };

  return (
    <div className="flex h-80 flex-col" data-testid="bid-chat">
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {all.length === 0 && (
          <p className="py-10 text-center text-xs text-zinc-600">
            No messages yet - say hi and align on the brief{otherName ? ` with ${otherName}` : ""} before the deal.
          </p>
        )}
        <AnimatePresence initial={false}>
          {all.map((m) => {
            const mine = m.sender === meSender;
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: m._pending ? 0.6 : 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${mine ? "bg-[#CCFF00] text-black rounded-br-md" : "bg-white/10 text-white rounded-bl-md"}`}>
                  {m.text}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 pt-3">
        <input
          data-testid="bid-chat-input"
          className="input-dark h-11 flex-1 text-sm"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button data-testid="bid-chat-send" className="btn-lime h-11 w-11 shrink-0 justify-center disabled:opacity-40" disabled={!text.trim()} onClick={send}>
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
