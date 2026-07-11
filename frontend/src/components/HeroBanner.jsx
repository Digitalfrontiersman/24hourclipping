import { Link } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Play, Scissors } from "lucide-react";

const HERO_IMG = "https://static.prod-images.emergentagent.com/jobs/aee39c4d-e5ff-44fc-90ef-b2c8fe3365c1/images/0709a19652f1f86584a5d93b2fd9733a8882038631038cfaffe379a115a5f08e.png";

const CAPTIONS = [
  ["THIS PLAY", "WAS INSANE!"],
  ["I CAN'T BELIEVE", "HE SAID THAT"],
  ["WAIT FOR", "THE ENDING…"],
  ["CHAT WENT", "ABSOLUTELY WILD"],
];

const BID_TOASTS = [
  { name: "Maya T.", amount: 78, avatar: "https://i.pravatar.cc/150?img=12" },
  { name: "Devon R.", amount: 110, avatar: "https://i.pravatar.cc/150?img=32" },
  { name: "Lena O.", amount: 45, avatar: "https://i.pravatar.cc/150?img=5" },
  { name: "Sasha I.", amount: 240, avatar: "https://i.pravatar.cc/150?img=47" },
];

const pad = (n) => String(n).padStart(2, "0");

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

export default function HeroBanner() {
  const [secondsLeft, setSecondsLeft] = useState(18 * 3600 + 24 * 60 + 7);
  const [capIdx, setCapIdx] = useState(0);
  const [toastIdx, setToastIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 24 * 3600 - 1 : s - 1)), 1000);
    const cap = setInterval(() => setCapIdx((i) => (i + 1) % CAPTIONS.length), 3200);
    const prog = setInterval(() => setProgress((p) => (p >= 100 ? 0 : p + 0.5)), 90);
    const toast = setInterval(() => setToastIdx((i) => (i + 1) % BID_TOASTS.length), 4200);
    const first = setTimeout(() => setToastIdx(0), 1600);
    return () => { clearInterval(tick); clearInterval(cap); clearInterval(prog); clearInterval(toast); clearTimeout(first); };
  }, []);

  const onMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ rx: (0.5 - py) * 14, ry: (px - 0.5) * 14, gx: px * 100, gy: py * 100 });
  }, []);

  const onLeave = useCallback(() => setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 }), []);

  const hh = pad(Math.floor(secondsLeft / 3600));
  const mm = pad(Math.floor((secondsLeft % 3600) / 60));
  const ss = pad(secondsLeft % 60);
  const clipSec = Math.floor((progress / 100) * 45);

  return (
    <section className="relative grain overflow-hidden" data-testid="hero-banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-20 lg:pt-24 lg:pb-24 grid lg:grid-cols-2 gap-14 lg:gap-8 items-center">

        {/* LEFT — copy */}
        <motion.div initial="hidden" animate="show" className="relative z-10">
          <motion.div variants={fadeUp} custom={0} className="label-caps text-[#CCFF00] mb-6" data-testid="hero-eyebrow">
            The 24-hour clipping marketplace
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6" data-testid="hero-headline">
            Your best moments.<br />
            Clipped in <span className="text-[#CCFF00] lime-flicker">24 hours.</span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-zinc-400 text-base md:text-lg leading-relaxed mb-10 max-w-md">
            Post the moment. Pick a vetted clipper.<br className="hidden sm:block" />
            Get a finished, ready-to-post clip before it gets old.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-5">
            <Link to="/customer/create" data-testid="hero-post-clip-btn" className="btn-lime h-14 px-8 text-base group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">Post a Clip <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" /></span>
              <span className="absolute inset-0 bg-white/30 -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
            </Link>
            <Link to="/marketplace" data-testid="hero-browse-jobs-btn" className="font-display font-bold text-white border-b-2 border-[#CCFF00] pb-1 hover:text-[#CCFF00] transition-colors inline-flex items-center gap-2">
              Browse Live Jobs
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} custom={4} className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-500">
            <span>Vetted clippers</span>
            <span className="w-1 h-1 rounded-full bg-[#CCFF00]" />
            <span>Deadline backed</span>
            <span className="w-1 h-1 rounded-full bg-[#CCFF00]" />
            <span>8% success fee</span>
          </motion.div>
        </motion.div>

        {/* RIGHT — interactive video card */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex justify-center" style={{ perspective: "1200px" }}>

          {/* orbit ring + moving dot */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[115%] aspect-square pointer-events-none hidden sm:block" aria-hidden="true">
            <div className="absolute inset-0 rounded-full border border-[#CCFF00]/25" />
            <div className="absolute inset-0 animate-orbit">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#CCFF00] shadow-[0_0_18px_4px_rgba(204,255,0,0.5)]" />
            </div>
            <div className="absolute inset-[-7%] rounded-full border border-dashed border-white/8 animate-orbit-reverse" style={{ animationDuration: "80s" }} />
          </div>

          <div
            ref={cardRef}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            data-testid="hero-video-card"
            className="relative w-full max-w-[400px] rounded-3xl overflow-hidden border border-white/10 bg-[#121212] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] transition-transform duration-150 will-change-transform"
            style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transformStyle: "preserve-3d" }}
          >
            {/* video area */}
            <div className="relative aspect-[3/4]">
              <img src={HERO_IMG} alt="Streamer reacting on camera" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/30" />
              {/* cursor glare */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(500px circle at ${tilt.gx}% ${tilt.gy}%, rgba(204,255,0,0.12), transparent 55%)` }} />

              {/* countdown badge */}
              <div className="absolute top-4 right-4 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 px-4 py-3" style={{ transform: "translateZ(50px)" }} data-testid="hero-countdown-badge">
                <div className="flex items-center gap-2 text-[11px] text-zinc-300 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" /> First cut due in
                </div>
                <div className="font-mono font-extrabold text-2xl tracking-tight leading-none">
                  {hh}<span className="colon-blink text-[#CCFF00]">:</span>{mm}<span className="colon-blink text-[#CCFF00]">:</span><span className="text-[#CCFF00]">{ss}</span>
                </div>
              </div>

              {/* clipping-in-progress chip */}
              <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md border border-[#FF4500]/60 text-[#FF4500] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ transform: "translateZ(40px)" }}>
                <Scissors className="w-3 h-3 clip-snip" /> Clipping
              </div>

              {/* live bid toast */}
              <div className="absolute left-4 bottom-[38%] right-4 pointer-events-none" style={{ transform: "translateZ(60px)" }}>
                <AnimatePresence mode="wait">
                  {toastIdx >= 0 && (
                    <motion.div key={toastIdx} initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="inline-flex items-center gap-2 rounded-full bg-black/75 backdrop-blur-md border border-[#CCFF00]/40 pl-1 pr-3 py-1" data-testid="hero-bid-toast">
                      <img src={BID_TOASTS[toastIdx].avatar} alt="" className="w-6 h-6 rounded-full border border-[#CCFF00]" />
                      <span className="text-xs font-bold">{BID_TOASTS[toastIdx].name}</span>
                      <span className="text-xs text-zinc-400">bid</span>
                      <span className="font-mono font-extrabold text-sm text-[#CCFF00]">${BID_TOASTS[toastIdx].amount}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* cycling caption */}
              <div className="absolute bottom-[22%] left-0 right-0 text-center px-6" style={{ transform: "translateZ(70px)" }} data-testid="hero-viral-caption">
                <AnimatePresence mode="wait">
                  <motion.div key={capIdx} initial={{ y: 18, opacity: 0, scale: 0.92 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.35 }}
                    className="font-display font-extrabold text-2xl sm:text-[28px] leading-tight uppercase drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                    <span className="text-white">{CAPTIONS[capIdx][0]}</span><br />
                    <span className="text-[#CCFF00]">{CAPTIONS[capIdx][1]}</span>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* scrubber */}
              <div className="absolute bottom-[13%] left-5 right-5 flex items-center gap-3" style={{ transform: "translateZ(45px)" }}>
                <span className="w-8 h-8 rounded-full bg-white/15 backdrop-blur flex items-center justify-center shrink-0"><Play className="w-3.5 h-3.5" fill="white" /></span>
                <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full bg-[#CCFF00] rounded-full transition-[width] duration-100" style={{ width: `${progress}%` }} />
                </div>
                <span className="font-mono text-[10px] text-zinc-300 shrink-0">00:{pad(clipSec)} / 00:45</span>
              </div>

              {/* before / after strip */}
              <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between gap-2" style={{ transform: "translateZ(35px)" }} data-testid="hero-before-after">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Before</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-9 rounded-md overflow-hidden border border-white/20 grayscale opacity-70"><img src={HERO_IMG} alt="" className="w-full h-full object-cover object-top" /></div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#CCFF00]" />
                  <div className="w-16 h-9 rounded-md overflow-hidden border border-[#CCFF00]/60 shadow-[0_0_14px_rgba(204,255,0,0.25)]"><img src={HERO_IMG} alt="" className="w-full h-full object-cover object-top" /></div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#CCFF00]">After</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
