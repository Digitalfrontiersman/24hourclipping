import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { dbAdapter } from "@/services/dbAdapter";
import Seo from "@/components/Seo";
import { Send, MessageSquare, ArrowLeft, ExternalLink } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(relativeTime);

const keyOf = (c) => `${c.type}:${c.id}`;
const roomLink = (c) =>
  c.type === "bid"
    ? (c.me_role === "customer" ? `/customer/bids/${c.project_id}` : `/clipper/job/${c.project_id}`)
    : (c.me_role === "customer" ? `/customer/clip-room/${c.id}` : `/clipper/room/${c.id}`);

export default function Messages() {
  const [convos, setConvos] = useState(null);
  const [activeKey, setActiveKey] = useState(null);
  const active = useMemo(() => (convos || []).find((c) => keyOf(c) === activeKey) || null, [convos, activeKey]);

  const loadConvos = useCallback(() => {
    dbAdapter.getConversations().then(setConvos).catch(() => setConvos([]));
  }, []);

  useEffect(() => {
    loadConvos();
    const t = setInterval(loadConvos, 10000);
    return () => clearInterval(t);
  }, [loadConvos]);

  return (
    <div className="bg-[#0A0A0A] text-white">
      <Seo title="Messages" path="/messages" description="Your conversations with creators and clippers on 24 Hour Clipping." />
      <div className="max-w-6xl w-full mx-auto px-0 sm:px-6 sm:py-6 h-[calc(100svh-4rem)]">
        <div className="h-full sm:rounded-2xl sm:border border-white/10 overflow-hidden bg-white/[0.015] grid lg:grid-cols-[340px_1fr]">
          {/* Conversation list */}
          <aside className={`min-h-0 flex-col border-r border-white/10 ${active ? "hidden lg:flex" : "flex"}`}>
            <div className="px-5 py-4 border-b border-white/10 shrink-0">
              <h1 className="font-display font-extrabold text-xl tracking-tight">Messages</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Creators and clippers you're talking to.</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {convos === null ? (
                <div className="p-3 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />)}</div>
              ) : convos.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3"><MessageSquare className="w-5 h-5 text-zinc-500" /></div>
                  <p className="font-display font-bold text-sm">No conversations yet</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Message a clipper on a bid, or a creator on a job, and it shows up here.</p>
                  <Link to="/marketplace" className="btn-ghost h-9 px-4 text-xs mt-4 inline-flex">Browse live jobs</Link>
                </div>
              ) : (
                <ul data-testid="conversation-list">
                  {convos.map((c) => {
                    const isActive = keyOf(c) === activeKey;
                    const needsReply = c.last_sender && c.last_sender !== c.me_role;
                    return (
                      <li key={keyOf(c)}>
                        <button data-testid={`conversation-${c.id}`} onClick={() => setActiveKey(keyOf(c))}
                          className={`w-full text-left flex gap-3 px-4 py-3.5 border-b border-white/[0.06] transition-colors ${isActive ? "bg-[#CCFF00]/[0.06]" : "hover:bg-white/[0.03]"}`}>
                          <img src={c.other.avatar} alt="" className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`truncate font-semibold text-sm ${needsReply ? "text-white" : "text-zinc-200"}`}>{c.other.name}</span>
                              <span className="ml-auto shrink-0 text-[10px] text-zinc-600">{c.last_at ? dayjs(c.last_at).fromNow(true) : ""}</span>
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate">{c.project_title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <p className={`truncate text-xs ${needsReply ? "text-zinc-300" : "text-zinc-500"}`}>
                                {c.last_text ? (c.last_sender === c.me_role ? "You: " : "") + c.last_text : <span className="italic text-zinc-600">No messages yet</span>}
                              </p>
                              {needsReply && <span className="ml-auto w-2 h-2 rounded-full bg-[#CCFF00] shrink-0" />}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Active thread */}
          <section className={`min-h-0 flex-col ${active ? "flex" : "hidden lg:flex"}`}>
            {active ? (
              <Thread key={keyOf(active)} convo={active} onBack={() => setActiveKey(null)} onSent={loadConvos} />
            ) : (
              <div className="flex-1 hidden lg:flex flex-col items-center justify-center text-center px-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4"><MessageSquare className="w-6 h-6 text-zinc-500" /></div>
                <p className="font-display font-bold">Select a conversation</p>
                <p className="text-sm text-zinc-500 mt-1">Pick someone on the left to see your messages.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Thread({ convo, onBack, onSent }) {
  const isBid = convo.type === "bid";
  const [msgs, setMsgs] = useState([]);
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const load = useCallback(() => {
    const p = isBid ? dbAdapter.getBidMessages(convo.id) : dbAdapter.getMessages(convo.id);
    p.then((server) => {
      setMsgs(server);
      setPending((pd) => pd.filter((tmp) => !server.some((s) => s.sender === tmp.sender && s.text === tmp.text)));
    }).catch(() => {});
  }, [convo.id, isBid]);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const all = [...msgs, ...pending];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [all.length]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    const tmp = { id: `tmp-${Date.now()}`, sender: convo.me_role, text: t, created_at: new Date().toISOString(), _pending: true };
    setPending((p) => [...p, tmp]);
    setText("");
    try {
      if (isBid) await dbAdapter.sendBidMessage(convo.id, t);
      else await dbAdapter.sendMessage(convo.id, convo.me_role, t);
      load();
      onSent?.();
    } catch {
      setPending((p) => p.filter((m) => m.id !== tmp.id));
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="message-thread">
      {/* header */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/10 shrink-0">
        <button onClick={onBack} className="lg:hidden text-zinc-400 hover:text-white -ml-1" aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
        <img src={convo.other.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-sm truncate">{convo.other.name}</div>
          <div className="text-[11px] text-zinc-500 truncate">{convo.project_title}</div>
        </div>
        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-zinc-400 border border-white/10 rounded-full px-2.5 py-1">{convo.context}</span>
        <Link to={roomLink(convo)} title="Open full job room" className="text-zinc-400 hover:text-white transition-colors"><ExternalLink className="w-4 h-4" /></Link>
      </div>

      {/* messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-2.5" data-testid="thread-messages">
        {all.length === 0 && (
          <p className="text-center text-xs text-zinc-600 pt-10">No messages yet - say hi and align on the brief with {convo.other.name.split(" ")[0]}.</p>
        )}
        <AnimatePresence initial={false}>
          {all.map((m) => {
            const mine = m.sender === convo.me_role;
            return (
              <motion.div key={m.id} layout initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: m._pending ? 0.6 : 1, y: 0, scale: 1 }} transition={{ duration: 0.18, ease: "easeOut" }}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${mine ? "bg-[#CCFF00] text-black rounded-br-md" : "bg-white/[0.07] text-white rounded-bl-md"}`}>
                  {m.text}
                  <div className={`text-[10px] mt-1 ${mine ? "text-black/50" : "text-zinc-500"}`}>{m.created_at ? dayjs(m.created_at).format("HH:mm") : ""}</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="flex gap-2 p-3 sm:p-4 border-t border-white/10 shrink-0">
        <input data-testid="thread-input" className="input-dark h-11 flex-1 text-sm" placeholder={`Message ${convo.other.name.split(" ")[0]}…`}
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button data-testid="thread-send" className="btn-lime h-11 w-11 shrink-0 justify-center disabled:opacity-40" disabled={!text.trim()} onClick={send} aria-label="Send">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
