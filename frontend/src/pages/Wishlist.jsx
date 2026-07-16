import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dbAdapter } from "@/services/dbAdapter";
import { notify } from "@/services/notificationAdapter";
import { useApp } from "@/context/AppContext";
import Seo from "@/components/Seo";
import EmptyState from "@/components/EmptyState";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ChevronUp, Plus, Loader2, Trash2, Lightbulb, X } from "lucide-react";

const STATUS = {
  open: { label: "Open", cls: "border-white/15 text-zinc-400" },
  planned: { label: "Planned", cls: "border-sky-400/40 text-sky-300 bg-sky-400/10" },
  in_progress: { label: "In progress", cls: "border-amber-400/40 text-amber-300 bg-amber-400/10" },
  shipped: { label: "Shipped", cls: "border-[#CCFF00]/40 text-[#CCFF00] bg-[#CCFF00]/10" },
  declined: { label: "Not planned", cls: "border-white/10 text-zinc-600" },
};
const STATUS_KEYS = Object.keys(STATUS);

export default function Wishlist() {
  const { isAuthed, roles } = useApp();
  const isAdmin = (roles || []).includes("admin");
  const [wishes, setWishes] = useState(null);
  const [sort, setSort] = useState("top");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => dbAdapter.listWishes(sort).then(setWishes).catch(() => setWishes([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [sort]);

  const vote = (w) => {
    if (!isAuthed) { notify.info("Log in to vote", "Sign in to upvote the ideas you want."); return; }
    // optimistic
    setWishes((ws) => ws.map((x) => x.id === w.id ? { ...x, voted: !x.voted, votes: x.votes + (x.voted ? -1 : 1) } : x));
    dbAdapter.voteWish(w.id)
      .then((r) => setWishes((ws) => ws.map((x) => x.id === w.id ? { ...x, votes: r.votes, voted: r.voted } : x)))
      .catch(() => { notify.urgent("Couldn't record your vote"); load(); });
  };

  const submit = () => {
    if (title.trim().length < 3) return notify.urgent("Give your idea a short title (3+ characters)");
    setSubmitting(true);
    dbAdapter.createWish({ title: title.trim(), description: desc.trim() })
      .then(() => { notify.success("Idea posted", "Thanks - others can vote on it now."); setTitle(""); setDesc(""); setShowForm(false); load(); })
      .catch((e) => notify.urgent(e.response?.data?.detail || "Couldn't post that idea"))
      .finally(() => setSubmitting(false));
  };

  const changeStatus = (w, status) => {
    dbAdapter.setWishStatus(w.id, status)
      .then(() => setWishes((ws) => ws.map((x) => x.id === w.id ? { ...x, status } : x)))
      .catch(() => notify.urgent("Couldn't update status"));
  };
  const remove = (w) => {
    dbAdapter.deleteWish(w.id)
      .then(() => setWishes((ws) => ws.filter((x) => x.id !== w.id)))
      .catch(() => notify.urgent("Couldn't delete"));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <Seo title="Feature wishlist" path="/wishlist" description="Suggest and vote on features you want on 24 Hour Clipping. Help shape the roadmap for the short-form clipping marketplace." />
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
        <div className="mb-8">
          <div className="label-caps mb-2">Wishlist</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter">Shape the roadmap</h1>
          <p className="text-sm text-zinc-500 mt-2 max-w-xl">Tell us what would make 24 Hour Clipping better, and upvote the ideas you want most. The most-wanted rise to the top.</p>
        </div>

        {/* controls */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1">
            {[["top", "Top voted"], ["new", "Newest"]].map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)} data-testid={`wish-sort-${k}`}
                className={`h-8 px-4 rounded-full text-xs font-bold transition-colors ${sort === k ? "bg-[#CCFF00] text-black" : "text-zinc-400 hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
          {isAuthed ? (
            <button data-testid="wish-suggest-btn" onClick={() => setShowForm((s) => !s)} className="btn-lime h-10 px-5 text-sm">
              {showForm ? <><X className="w-4 h-4" /> Close</> : <><Plus className="w-4 h-4" /> Suggest a feature</>}
            </button>
          ) : (
            <Link to="/login" className="btn-ghost h-10 px-5 text-sm">Log in to suggest &amp; vote</Link>
          )}
        </div>

        {/* submit form */}
        {showForm && isAuthed && (
          <div className="card-dark p-5 mb-6" data-testid="wish-form">
            <input data-testid="wish-title" className="input-dark h-12 mb-3" maxLength={160} placeholder="Feature title - e.g. Bulk-upload multiple clips at once" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea data-testid="wish-desc" className="input-dark h-24 py-2.5 text-sm mb-3" maxLength={2000} placeholder="Optional: what problem would it solve, and how would it work?" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex justify-end">
              <button data-testid="wish-submit" className="btn-lime h-11 px-6" disabled={submitting || title.trim().length < 3} onClick={submit}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post idea"}
              </button>
            </div>
          </div>
        )}

        {/* list */}
        {wishes === null ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card-dark h-24 animate-pulse" />)}</div>
        ) : wishes.length === 0 ? (
          <EmptyState icon={Lightbulb} title="No ideas yet" hint="Be the first to suggest a feature that would make a difference." cta={isAuthed ? "Suggest a feature" : "Log in to suggest"} to={isAuthed ? undefined : "/login"} onAction={isAuthed ? () => setShowForm(true) : undefined} />
        ) : (
          <div className="space-y-3" data-testid="wish-list">
            {wishes.map((w) => {
              const st = STATUS[w.status] || STATUS.open;
              return (
                <div key={w.id} className="card-dark p-4 flex gap-4" data-testid={`wish-${w.id}`}>
                  <button onClick={() => vote(w)} data-testid={`wish-vote-${w.id}`} aria-pressed={w.voted}
                    className={`shrink-0 w-11 rounded-lg border flex flex-col items-center justify-center py-1.5 gap-0.5 transition-colors active:scale-95 ${w.voted ? "border-[#CCFF00]/60 bg-[#CCFF00]/10 text-[#CCFF00]" : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"}`}>
                    <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.75} />
                    <span className="font-mono font-bold text-sm leading-none tabular-nums">{w.votes}</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-bold text-white">{w.title}</h3>
                      <span className={`text-[10px] font-bold uppercase tracking-widest border rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                    </div>
                    {w.description && <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed whitespace-pre-line">{w.description}</p>}
                    <p className="text-xs text-zinc-600 mt-2">{w.author} · {w.created_at ? new Date(w.created_at).toLocaleDateString() : ""}</p>
                    {isAdmin && (
                      <div className="flex items-center gap-2 mt-3">
                        <Select value={w.status} onValueChange={(v) => changeStatus(w, v)}>
                          <SelectTrigger data-testid={`wish-status-${w.id}`} className="h-8 w-[150px] rounded-lg bg-white/[0.04] border-white/10 text-xs font-semibold text-zinc-300 hover:text-white hover:border-white/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_KEYS.map((k) => <SelectItem key={k} value={k} className="text-xs">{STATUS[k].label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <button onClick={() => remove(w)} title="Delete idea" className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-zinc-500 hover:text-[#FF4500] hover:border-[#FF4500]/40 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
