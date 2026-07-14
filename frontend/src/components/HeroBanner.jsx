import { Link } from "react-router-dom";
import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const HERO_POSTER = "/hero_streamer_a.png";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

export default function HeroBanner() {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => { const p = v.play(); if (p && typeof p.catch === "function") p.catch(() => {}); };
    tryPlay();
    v.addEventListener("canplay", tryPlay);
    return () => v.removeEventListener("canplay", tryPlay);
  }, []);

  const onMove = useCallback((e) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ rx: (0.5 - py) * 10, ry: (px - 0.5) * 10, gx: px * 100, gy: py * 100 });
  }, []);

  const onLeave = useCallback(() => setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 }), []);

  return (
    <section className="relative grain overflow-hidden min-h-[calc(100svh-4rem)] flex items-center" data-testid="hero-banner">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12 grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-8 items-center">

        {/* LEFT - static copy */}
        <motion.div initial="hidden" animate="show" className="relative z-10">
          <motion.div variants={fadeUp} custom={0} className="label-caps text-[#CCFF00] mb-3 sm:mb-6 text-[10px] sm:text-xs" data-testid="hero-eyebrow">
            The 24-hour clipping marketplace
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-3 sm:mb-6" data-testid="hero-headline">
            Your best moments.<br />
            Clipped in <span className="text-[#CCFF00] lime-flicker">24 hours.</span>
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-zinc-400 text-sm sm:text-base md:text-lg leading-relaxed mb-5 sm:mb-10 max-w-md">
            Post the moment. Pick a vetted clipper.<br className="hidden sm:block" />
            Get a finished, ready-to-post clip before it gets old.
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center gap-4 sm:gap-5">
            <Link to="/customer/create" data-testid="hero-post-clip-btn" className="btn-lime h-11 sm:h-14 px-6 sm:px-8 text-sm sm:text-base group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">Post a Clip <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" /></span>
              <span className="absolute inset-0 bg-white/30 -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
            </Link>
            <Link to="/marketplace" data-testid="hero-browse-jobs-btn" className="font-display font-bold text-sm sm:text-base text-white border-b-2 border-[#CCFF00] pb-1 hover:text-[#CCFF00] transition-colors inline-flex items-center gap-2">
              Browse Live Jobs
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} custom={4} className="mt-5 sm:mt-10 flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-2 text-[11px] sm:text-sm text-zinc-500">
            <span>Vetted clippers</span>
            <span className="w-1 h-1 rounded-full bg-[#CCFF00]" />
            <span>Deadline backed</span>
            <span className="w-1 h-1 rounded-full bg-[#CCFF00]" />
            <span>8% success fee</span>
          </motion.div>
        </motion.div>

        {/* RIGHT - autoplay video card */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center" style={{ perspective: "1200px" }}>

          {/* orbit ring - desktop only */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] aspect-square pointer-events-none hidden lg:block" aria-hidden="true">
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
            className="relative w-full max-w-[560px] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.85)] transition-transform duration-150 will-change-transform"
            style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transformStyle: "preserve-3d" }}
          >
            <div className="relative aspect-video">
              <video
                ref={videoRef}
                data-testid="hero-video"
                poster={HERO_POSTER}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="absolute inset-0 w-full h-full object-cover"
              >
                <source src="/hero_loop.webm" type="video/webm" />
                <source src="/hero_loop.mp4" type="video/mp4" />
              </video>
              {/* subtle cursor glare - desktop only */}
              <div className="absolute inset-0 pointer-events-none hidden lg:block" style={{ background: `radial-gradient(500px circle at ${tilt.gx}% ${tilt.gy}%, rgba(204,255,0,0.10), transparent 55%)` }} />
              {/* tiny LIVE tag - bottom-left, unobtrusive */}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 inline-flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md border border-[#CCFF00]/60 text-[#CCFF00] px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest" style={{ transform: "translateZ(40px)" }} data-testid="hero-live-tag">
                Live demo
              </div>
            </div>
          </div>

          {/* transform stat strip - honest before→after in numbers, video card carries the visual proof */}
          <div className="mt-4 sm:mt-6 w-full max-w-[560px] flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl bg-white/[0.03] border border-white/10 px-4 sm:px-5 py-3" data-testid="hero-before-after">
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Before</span>
              <span className="text-sm sm:text-base font-bold text-zinc-300">45-min VOD</span>
            </div>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#CCFF00] shrink-0" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#CCFF00]">After</span>
              <span className="text-sm sm:text-base font-bold text-white">0:45 clip</span>
            </div>
            <span className="hidden sm:block w-px h-8 bg-white/10" />
            <div className="hidden sm:flex flex-col items-end gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Turnaround</span>
              <span className="text-sm sm:text-base font-bold text-white font-mono">under 24h</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
