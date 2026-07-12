import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Zap, Play, Heart, Clock, Sparkles } from "lucide-react";

const LIME = "#D8FF2E";

const NAV_LINKS = [
  { label: "Live jobs", to: "/marketplace" },
  { label: "Clippers", to: "/clippers" },
  { label: "How it works", to: "/#how-it-works", hash: true },
];

// Deterministic decorative particles (no random → no layout jitter).
const PARTICLES = [
  { x: "8%", y: "22%", s: 2, d: 0 }, { x: "18%", y: "68%", s: 3, d: 1.2 },
  { x: "30%", y: "14%", s: 2, d: 2.1 }, { x: "44%", y: "82%", s: 2, d: 0.6 },
  { x: "58%", y: "10%", s: 3, d: 1.8 }, { x: "66%", y: "60%", s: 2, d: 2.6 },
  { x: "74%", y: "30%", s: 2, d: 0.3 }, { x: "86%", y: "74%", s: 3, d: 1.5 },
  { x: "90%", y: "40%", s: 2, d: 2.3 }, { x: "12%", y: "48%", s: 2, d: 3.1 },
];

// Public sample clips (Google gtv bucket) — real looping video in the cards.
// Vertical thumbnails styled as short-form clips (reliable Unsplash CDN).
const IMG = "https://images.unsplash.com/";
const IQ = "?w=380&h=680&fit=crop&q=72";
const CARDS = [
  { creator: "Maya Torres", handle: "@mayaclips", caption: "Ranked finals clutch", genre: "Gaming", grad: "from-violet-600 to-indigo-950", img: IMG + "photo-1542751371-adc38448a05e" + IQ, av: 12, views: "1.2M", pct: 82 },
  { creator: "Devon Reeves", handle: "@devcuts", caption: "Founder burnout, unfiltered", genre: "Podcast", grad: "from-amber-500 to-red-950", img: IMG + "photo-1516280440614-37939bbacd81" + IQ, av: 32, views: "840K", pct: 64 },
  { creator: "Lena Okafor", handle: "@lenareels", caption: "IRL fail compilation", genre: "IRL", grad: "from-emerald-500 to-teal-950", img: IMG + "photo-1487412720507-e7ab37603c6f" + IQ, av: 5, views: "2.4M", pct: 96 },
  { creator: "Jonah Park", handle: "@jonahtalks", caption: "The 3am launch story", genre: "Founder", grad: "from-sky-500 to-blue-950", img: IMG + "photo-1560253023-3ec5d502959f" + IQ, av: 68, views: "512K", pct: 47 },
  { creator: "Sasha Ivanov", handle: "@sashaedits", caption: "Launch teaser — 6s hook", genre: "Ad", grad: "from-fuchsia-600 to-purple-950", img: IMG + "photo-1585829365295-ab7cd400c167" + IQ, av: 47, views: "3.1M", pct: 73 },
  { creator: "Rio Almeida", handle: "@rioshorts", caption: "Neon city timelapse", genre: "Shorts", grad: "from-lime-500 to-green-950", img: IMG + "photo-1598550476439-6847785fcea6" + IQ, av: 15, views: "690K", pct: 88 },
  { creator: "Aria Chen", handle: "@ariastreams", caption: "Set the vibe", genre: "Music", grad: "from-rose-500 to-pink-950", img: IMG + "photo-1470225620780-dba8ba36b745" + IQ, av: 16, views: "1.8M", pct: 55 },
];

function VideoCard({ c, focus }) {
  return (
    <div className={`relative h-[336px] w-[196px] overflow-hidden rounded-[22px] border ${focus ? "border-[#D8FF2E]/40" : "border-white/10"} bg-white/[0.04] backdrop-blur-xl`}
         style={{ boxShadow: focus ? `0 24px 70px -18px rgba(0,0,0,0.9), 0 0 46px -8px ${LIME}66` : "0 20px 50px -22px rgba(0,0,0,0.9)" }}>
      {/* content thumbnail */}
      <div className={`absolute inset-0 bg-gradient-to-br ${c.grad}`} />
      <img className="absolute inset-0 h-full w-full object-cover" src={c.img} alt="" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
      {/* top row */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <span className="rounded-md bg-black/45 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm">{c.genre}</span>
        <span className="flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[9px] text-white/90 backdrop-blur-sm"><Clock className="h-2.5 w-2.5" />0:{(c.pct % 60).toString().padStart(2, "0")}</span>
      </div>
      {/* center play */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${focus ? "bg-[#D8FF2E] text-black" : "bg-white/85 text-black"} shadow-lg`}>
          <Play className="h-4 w-4" fill="currentColor" />
        </span>
      </div>
      {/* bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="mb-2 flex items-center gap-2">
          <img src={`https://i.pravatar.cc/60?img=${c.av}`} alt="" className="h-6 w-6 rounded-full border border-white/40" />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold leading-tight text-white">{c.creator}</p>
            <p className="truncate text-[9px] leading-tight text-white/60">{c.handle}</p>
          </div>
        </div>
        <p className="mb-2 line-clamp-1 text-[11px] font-semibold text-white/95">{c.caption}</p>
        <div className="mb-2 flex items-center gap-3 text-[9px] text-white/70">
          <span className="flex items-center gap-1"><Play className="h-2.5 w-2.5" fill="currentColor" />{c.views}</span>
          <span className="flex items-center gap-1"><Heart className="h-2.5 w-2.5" fill="currentColor" />{Math.round(c.pct / 4)}K</span>
        </div>
        {/* edit progress */}
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#D8FF2E]" style={{ width: `${c.pct}%` }} />
          </div>
          <span className="font-mono text-[8px] text-[#D8FF2E]">{c.pct}%</span>
        </div>
      </div>
    </div>
  );
}

// Infinite horizontal coverflow: cards slide sideways one slot every tick and
// wrap seamlessly. Distance from centre drives x / scale / rotateY / blur so the
// centre card sits upright + in focus and neighbours recede in 3D.
function VideoCarousel({ reduce }) {
  const N = CARDS.length; // 7 → symmetric slots -3..3
  const [active, setActive] = useState(0);
  const prev = useRef({});
  const SPACING = 124;

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setActive((a) => a + 1), 2600);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="relative h-full w-full" style={{ perspective: 1600 }}>
      {CARDS.map((c, i) => {
        const raw = (((i - active) % N) + N) % N;
        const slot = raw <= N / 2 ? raw : raw - N; // -3..3, 0 = centre
        const mag = Math.abs(slot);
        const prevSlot = prev.current[i];
        const wrap = prevSlot !== undefined && Math.abs(slot - prevSlot) > 1;
        prev.current[i] = slot;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ marginLeft: -98, marginTop: -168, zIndex: 40 - mag * 5, transformStyle: "preserve-3d" }}
            initial={false}
            animate={{
              x: slot * SPACING,
              scale: 1 - mag * 0.14,
              rotateY: slot * -11,
              opacity: mag >= 3 ? 0 : 1 - mag * 0.24,
              filter: `blur(${mag * 1.4}px)`,
            }}
            transition={wrap ? { duration: 0 } : { type: "spring", stiffness: 55, damping: 18, mass: 0.9 }}
          >
            <motion.div
              animate={reduce ? {} : { y: [0, slot === 0 ? -8 : -4, 0] }}
              transition={{ duration: 5 + mag, repeat: Infinity, ease: "easeInOut" }}
            >
              <VideoCard c={c} focus={slot === 0} />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#050505] grain text-white">
      {/* ===================== BACKGROUND ===================== */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[560px] w-[560px] rounded-full opacity-60"
             style={{ background: "radial-gradient(circle, rgba(60,70,50,0.28), transparent 62%)" }} />
        <div className="hero-glow absolute right-[16%] top-1/2 h-[600px] w-[600px] -translate-y-1/2 rounded-full blur-[130px]"
             style={{ background: `radial-gradient(circle, ${LIME}2e, transparent 60%)` }} />
        <div className="absolute inset-0"
             style={{ background: "radial-gradient(120% 120% at 50% 40%, transparent 55%, rgba(0,0,0,0.78) 100%)" }} />
        <div className="absolute inset-0 opacity-[0.05]"
             style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
        {PARTICLES.map((p, i) => (
          <span key={i} className="hero-twinkle absolute rounded-full" style={{ left: p.x, top: p.y, width: p.s, height: p.s, background: LIME, animationDelay: `${p.d}s`, boxShadow: `0 0 6px ${LIME}` }} />
        ))}
        <svg className="absolute inset-0 h-full w-full opacity-[0.16]" aria-hidden>
          <defs>
            <pattern id="hdots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill={LIME} opacity="0.5" /></pattern>
          </defs>
          <rect x="58%" y="10%" width="36%" height="26%" fill="url(#hdots)" />
          <path d="M 60% 80% L 72% 68% L 86% 72%" stroke={LIME} strokeWidth="1" strokeDasharray="4 6" fill="none" className="hero-dash" opacity="0.5" />
        </svg>
        <div className="hero-spin-slow absolute right-[6%] top-[16%] h-24 w-24 rounded-full border" style={{ borderColor: `${LIME}22` }} />
      </div>

      {/* ===================== NAV ===================== */}
      <nav className="relative z-20 mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2" aria-label="24 Hour Clipping — home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-black" style={{ background: LIME }}><Zap className="h-5 w-5" fill="#000" /></span>
          <span className="font-display text-lg font-extrabold tracking-tight">24<span style={{ color: LIME }}>Clip</span></span>
        </Link>
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 md:flex">
          {NAV_LINKS.map((l) => l.hash
            ? <a key={l.label} href={l.to} className="hero-underline text-sm font-medium text-zinc-400 transition-colors hover:text-white">{l.label}</a>
            : <Link key={l.label} to={l.to} className="hero-underline text-sm font-medium text-zinc-400 transition-colors hover:text-white">{l.label}</Link>)}
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden text-sm font-semibold text-zinc-300 transition-colors hover:text-white sm:inline-flex">Sign in</Link>
          <Link to="/clipper/onboarding" data-testid="nav-become-clipper"
                className="group inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-bold text-black transition-all hover:bg-zinc-200 active:scale-95">
            Become a clipper <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>

      {/* ===================== CONTENT ===================== */}
      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-16 lg:grid-cols-[46%_54%] lg:gap-8 lg:px-8">
        {/* ---------- LEFT ---------- */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: LIME }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: LIME }} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-300">The 24-hour clipping marketplace</span>
          </div>

          <h1 className="font-display font-extrabold uppercase leading-[0.92] tracking-tight text-4xl sm:text-5xl lg:text-6xl xl:text-[68px]">
            <span className="block text-white">Your best moments.</span>
            <span className="block" style={{ color: LIME, textShadow: `0 0 44px ${LIME}55` }}>Clipped in just</span>
            <span className="block" style={{ color: LIME, textShadow: `0 0 44px ${LIME}55` }}>24 hours.</span>
          </h1>

          <p className="mt-7 flex flex-wrap items-center gap-x-2 text-xl font-bold text-white sm:text-2xl">
            Guaranteed. Or
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 font-extrabold text-black" style={{ background: LIME }}>YOU</span>
            Get Paid.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link to="/customer/create" data-testid="hero-post-clip-btn"
                  className="group inline-flex h-14 items-center gap-2 rounded-full px-8 text-base font-bold text-black transition-all active:scale-95"
                  style={{ background: LIME }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 40px -6px ${LIME}`)}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}>
              Post a Job <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/marketplace" className="hero-underline inline-flex h-14 items-center gap-2 px-2 text-base font-semibold text-white/90">
              <Play className="h-4 w-4" style={{ color: LIME }} fill={LIME} /> Browse Live Jobs
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-zinc-500">
            {["Vetted Clippers", "Deadline Backed", "Accountability"].map((t, i) => (
              <span key={t} className="inline-flex items-center gap-3">
                {i > 0 && <span className="h-1 w-1 rounded-full" style={{ background: LIME }} />}
                {t}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ---------- RIGHT: infinite video carousel ---------- */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="relative mx-auto h-[440px] w-full max-w-[420px] lg:h-[600px]">
          {/* depth glow */}
          <div className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]" style={{ background: `radial-gradient(circle, ${LIME}26, transparent 62%)` }} />
          {/* decorative connectors */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            <path d="M 40 120 C 110 170, 130 220, 150 280" stroke={LIME} strokeWidth="1" strokeDasharray="3 6" fill="none" opacity="0.3" className="hero-dash" />
            <path d="M 380 460 C 320 400, 300 340, 280 300" stroke="#fff" strokeWidth="1" strokeDasharray="3 6" fill="none" opacity="0.12" />
            <circle cx="40" cy="120" r="3" fill={LIME} opacity="0.8" />
            <circle cx="380" cy="460" r="3" fill={LIME} opacity="0.6" />
          </svg>
          {/* floating widgets */}
          <div className="pointer-events-none absolute left-1 top-10 z-30 rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-[9px] font-mono text-zinc-400 backdrop-blur-sm">
            <Sparkles className="mr-1 inline h-2.5 w-2.5" style={{ color: LIME }} /> queue · 12 clips
          </div>
          <div className="pointer-events-none absolute right-0 bottom-16 z-30 rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 backdrop-blur-sm">
            <p className="font-mono text-[9px] text-zinc-500">avg. turnaround</p>
            <p className="font-mono text-sm font-extrabold" style={{ color: LIME }}>18h 42m</p>
          </div>
          {/* left/right fade so cards enter/exit cleanly */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-[#050505] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-[#050505] to-transparent" />
          {/* the carousel */}
          <VideoCarousel reduce={reduce} />
        </motion.div>
      </div>
    </section>
  );
}
