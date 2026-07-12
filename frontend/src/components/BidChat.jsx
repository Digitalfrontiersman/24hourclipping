import { useEffect, useRef, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import { Send, Loader2 } from "lucide-react";

// Pre-acceptance chat between a creator and a bidding clipper (keyed by bid).
// `meSender` is "customer" (creator) or "clipper" — decides bubble alignment.
export default function BidChat({ bidId, meSender, otherName }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = () => dbAdapter.getBidMessages(bidId).then(setMsgs).catch(() => {});
  useEffect(() => {
    if (!bidId) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await dbAdapter.sendBidMessage(bidId, t);
      setText("");
      await load();
    } catch {
      /* surfaced by interceptor */
    }
    setSending(false);
  };

  return (
    <div className="flex h-80 flex-col" data-testid="bid-chat">
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <p className="py-10 text-center text-xs text-zinc-600">
            No messages yet — say hi and align on the brief{otherName ? ` with ${otherName}` : ""} before the deal.
          </p>
        )}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender === meSender ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender === meSender ? "bg-[#CCFF00] text-black" : "bg-white/10 text-white"}`}>
              {m.text}
            </div>
          </div>
        ))}
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
        <button data-testid="bid-chat-send" className="btn-lime h-11 w-12 shrink-0" disabled={sending} onClick={send}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
