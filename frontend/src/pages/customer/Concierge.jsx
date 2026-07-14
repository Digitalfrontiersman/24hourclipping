import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { aiAdapter } from "@/services/aiAdapter";
import { dbAdapter } from "@/services/dbAdapter";
import { storageAdapter } from "@/services/storageAdapter";
import { notify } from "@/services/notificationAdapter";
import { Sparkles, Send, Mic, Paperclip, FileVideo, Wand2, Loader2 } from "lucide-react";

const SUGGESTIONS = ["I have a Twitch VOD with an insane clutch moment", "Clip my latest podcast episode into shorts", "I need a 15s product ad for TikTok", "Find the best moment in my founder interview"];

export default function Concierge() {
  const nav = useNavigate();
  const [sessionId] = useState(() => {
    const existing = sessionStorage.getItem("24hc_ai_session");
    if (existing) return existing;
    const id = `session-${Date.now()}`;
    sessionStorage.setItem("24hc_ai_session", id);
    return id;
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [genBrief, setGenBrief] = useState(false);
  const [brief, setBrief] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const recogRef = useRef(null);

  useEffect(() => {
    aiAdapter.getHistory(sessionId).then((h) => {
      if (h.length) setMessages(h.map((m) => ({ role: m.sender, text: m.text })));
      else setMessages([{ role: "ai", text: "Hey - I'm your Clipping Concierge. Tell me about the footage you want turned into a clip. What is it, and where does it live?" }]);
    }).catch(() => setMessages([{ role: "ai", text: "Hey - I'm your Clipping Concierge. Tell me about the footage you want turned into a clip. What is it, and where does it live?" }]));
  }, [sessionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, brief]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || streaming) return;
    setInput("");
    const withAttach = attachment ? `${msg}\n[Attached: ${attachment.name}]` : msg;
    setAttachment(null);
    setMessages((m) => [...m, { role: "user", text: withAttach }, { role: "ai", text: "" }]);
    setStreaming(true);
    try {
      await aiAdapter.streamChat(sessionId, withAttach, (delta) => {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "ai", text: copy[copy.length - 1].text + delta };
          return copy;
        });
      });
    } catch {
      notify.urgent("The concierge hit a snag", "Please try again");
      setMessages((m) => m.slice(0, -1));
    }
    setStreaming(false);
  };

  const mic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return notify.info("Voice input isn't supported in this browser", "Type your answer instead");
    if (listening) { recogRef.current?.stop(); return; }
    const r = new SR();
    recogRef.current = r;
    r.onresult = (e) => setInput(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.start();
    setListening(true);
  };

  const attach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await storageAdapter.upload(file, () => {});
    setAttachment(file);
    notify.success("File attached", file.name);
  };

  const generateBrief = async () => {
    setGenBrief(true);
    try {
      const b = await aiAdapter.generateBrief(sessionId);
      setBrief(b);
    } catch {
      notify.urgent("Brief generation failed", "Add a bit more detail and try again");
    }
    setGenBrief(false);
  };

  const proceed = async () => {
    try {
      const { bond, ...payload } = brief;
      const p = await dbAdapter.createProject(payload);
      sessionStorage.removeItem("24hc_ai_session");
      nav(`/customer/checkout/${p.id}`);
    } catch {
      notify.urgent("Could not create the project");
    }
  };

  const userTurns = messages.filter((m) => m.role === "user").length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#0A0A0A] text-white flex flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 flex flex-col flex-1">
        <div className="py-6 flex items-center gap-3 border-b border-white/10">
          <span className="w-10 h-10 rounded-full bg-[#CCFF00] flex items-center justify-center"><Sparkles className="w-5 h-5 text-black" /></span>
          <div>
            <h1 className="font-display font-extrabold tracking-tight">AI Clipping Concierge</h1>
            <p className="text-xs text-zinc-500">A short conversation → a complete project brief</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 space-y-4" data-testid="concierge-messages">
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "ml-auto bg-[#CCFF00] text-black font-medium" : "bg-[#1A1A1A] border border-white/10"}`}>
              {m.text || <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
            </motion.div>
          ))}

          {brief && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card-dark border-[#CCFF00]/40 p-6" data-testid="generated-brief">
              <div className="label-caps mb-3">Your one-page project brief</div>
              <input className="input-dark mb-3 font-display font-bold" data-testid="brief-title-input" value={brief.title} onChange={(e) => setBrief({ ...brief, title: e.target.value })} />
              <textarea className="input-dark h-20 py-3 mb-3 text-sm" value={brief.description} onChange={(e) => setBrief({ ...brief, description: e.target.value })} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mb-4">
                {[["Category", "category"], ["Platform", "platform"], ["Length", "output_length"], ["Ratio", "aspect_ratio"], ["Mood", "mood"], ["Captions", "captions"]].map(([l, k]) => (
                  <div key={k} className="bg-black/40 rounded-lg p-2.5"><span className="text-zinc-500 block">{l}</span><span className="font-bold">{brief[k]}</span></div>
                ))}
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-zinc-400">Budget</span>
                <span className="font-mono font-extrabold text-xl text-[#CCFF00]">${brief.budget}</span>
              </div>
              <button data-testid="brief-proceed-btn" className="btn-lime h-12 w-full" onClick={proceed}>Looks right - go to checkout</button>
            </motion.div>
          )}
          <div ref={endRef} />
        </div>

        {!brief && messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 pb-4">
            {SUGGESTIONS.map((s) => (
              <button key={s} data-testid="suggestion-chip" onClick={() => send(s)} className="text-xs bg-white/5 border border-white/10 rounded-full px-4 py-2 text-zinc-300 hover:border-[#CCFF00]/50 hover:text-white transition-colors">{s}</button>
            ))}
          </div>
        )}

        {attachment && <div className="flex items-center gap-2 text-xs text-[#CCFF00] pb-2"><FileVideo className="w-4 h-4" /> {attachment.name} attached</div>}

        <div className="pb-6 space-y-3">
          {userTurns >= 2 && !brief && (
            <button data-testid="generate-brief-btn" onClick={generateBrief} disabled={genBrief} className="btn-white h-12 w-full">
              {genBrief ? <><Loader2 className="w-4 h-4 animate-spin" /> Building your brief…</> : <><Wand2 className="w-4 h-4" /> Generate Brief</>}
            </button>
          )}
          <div className="flex items-center gap-2 card-dark p-2">
            <label className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors" data-testid="attach-file-btn">
              <input type="file" className="hidden" onChange={attach} />
              <Paperclip className="w-4 h-4 text-zinc-400" />
            </label>
            <input data-testid="concierge-input" className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-600" placeholder="Describe your footage, goals, budget…"
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button data-testid="mic-btn" onClick={mic} aria-label="Voice input"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${listening ? "bg-[#FF4500] text-white animate-pulse" : "hover:bg-white/10 text-zinc-400"}`}>
              <Mic className="w-4 h-4" />
            </button>
            <button data-testid="concierge-send-btn" onClick={() => send()} disabled={streaming} className="btn-lime w-10 h-10 rounded-full p-0" aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
