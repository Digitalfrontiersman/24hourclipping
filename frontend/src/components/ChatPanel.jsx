import { useEffect, useRef, useState } from "react";
import { dbAdapter } from "@/services/dbAdapter";
import { Send } from "lucide-react";
import dayjs from "dayjs";

export default function ChatPanel({ contractId, me, other }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const load = () => dbAdapter.getMessages(contractId).then(setMessages).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    const msg = await dbAdapter.sendMessage(contractId, me, text.trim());
    setMessages((m) => [...m, msg]);
    setText("");
  };

  return (
    <div className="flex flex-col h-80">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1" data-testid="chat-messages">
        {messages.length === 0 && <p className="text-xs text-zinc-600 text-center pt-8">No messages yet. Say hi - fast communication wins.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${m.sender === me ? "ml-auto bg-[#CCFF00] text-black" : "bg-black/50 border border-white/10"}`}>
            {m.text}
            <div className={`text-[10px] mt-1 ${m.sender === me ? "text-black/50" : "text-zinc-600"}`}>{m.sender === me ? "You" : other} · {dayjs(m.created_at).format("HH:mm")}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input data-testid="chat-input" className="input-dark h-11 text-sm flex-1" placeholder="Message…" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button data-testid="chat-send-btn" className="btn-lime w-11 h-11 rounded-full p-0 shrink-0" onClick={send} aria-label="Send"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
