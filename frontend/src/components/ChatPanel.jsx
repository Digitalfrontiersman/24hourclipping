import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { dbAdapter } from "@/services/dbAdapter";
import { Send } from "lucide-react";
import dayjs from "dayjs";

export default function ChatPanel({ contractId, me, other }) {
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const load = useCallback(() => {
    dbAdapter.getMessages(contractId)
      .then((server) => {
        setMessages(server);
        setPending((p) => p.filter((tmp) => !server.some((s) => s.sender === tmp.sender && s.text === tmp.text)));
      })
      .catch(() => {});
  }, [contractId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const all = [...messages, ...pending];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [all.length]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const tmp = { id: `tmp-${Date.now()}`, sender: me, text: t, created_at: new Date().toISOString(), _pending: true };
    setPending((p) => [...p, tmp]);
    setText("");
    try {
      await dbAdapter.sendMessage(contractId, me, t);
      load();
    } catch {
      setPending((p) => p.filter((m) => m.id !== tmp.id));
    }
  };

  return (
    <div className="flex flex-col h-80">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-testid="chat-messages">
        {all.length === 0 && <p className="text-xs text-zinc-600 text-center pt-8">No messages yet. Say hi - fast communication wins.</p>}
        <AnimatePresence initial={false}>
          {all.map((m) => {
            const mine = m.sender === me;
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: m._pending ? 0.6 : 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "ml-auto bg-[#CCFF00] text-black rounded-br-md" : "bg-black/50 border border-white/10 rounded-bl-md"}`}
              >
                {m.text}
                <div className={`text-[10px] mt-1 ${mine ? "text-black/50" : "text-zinc-600"}`}>{mine ? "You" : other} · {dayjs(m.created_at).format("HH:mm")}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input data-testid="chat-input" className="input-dark h-11 text-sm flex-1" placeholder="Message…" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button data-testid="chat-send-btn" className="btn-lime w-11 h-11 rounded-full p-0 shrink-0 justify-center disabled:opacity-40" disabled={!text.trim()} onClick={send} aria-label="Send"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
