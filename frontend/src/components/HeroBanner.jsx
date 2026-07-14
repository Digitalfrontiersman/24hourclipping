import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock, ShieldCheck, BadgeCheck } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

const STATS = [
  [Clock, "18h 42m", "avg first-cut turnaround"],
  [ShieldCheck, "24h", "deadline, or money back"],
  [BadgeCheck, "8%", "fee, only on approval"],
];

export default function HeroBanner() {
  return (
    <section className="relative grain overflow-hidden min-h-[calc(100svh-4rem)] flex items-center justify-center" data-testid="hero-banner">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-[12%] left-1/2 -translate-x-1/2 w-[64rem] h-[40rem] rounded-full bg-[#CCFF00]/[0.08] blur-[150px]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-[-25%] right-[-8%] w-[38rem] h-[38rem] rounded-full bg-[#CCFF00]/[0.045] blur-[130px]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-[-25%] left-[-8%] w-[32rem] h-[32rem] rounded-full bg-white/[0.02] blur-[120px]" aria-hidden="true" />

      <motion.div initial="hidden" animate="show" className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-[#CCFF00]/25 bg-[#CCFF00]/[0.06] px-4 py-1.5 mb-8" data-testid="hero-eyebrow">
          <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#CCFF00]">The 24-hour clipping marketplace</span>
        </motion.div>

        <motion.h1 variants={fadeUp} custom={1} className="font-display font-extrabold tracking-tight leading-[1.02] text-4xl sm:text-6xl lg:text-7xl mb-6" data-testid="hero-headline">
          Your best moments,<br className="hidden sm:block" /> clipped in <span className="text-[#CCFF00] lime-flicker">24 hours</span>.
        </motion.h1>

        <motion.p variants={fadeUp} custom={2} className="text-zinc-400 text-base sm:text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto mb-9">
          Post the moment, pick a vetted clipper, and get a finished, ready-to-post clip before it gets old - on the clock, or your money back.
        </motion.p>

        <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 mb-14">
          <Link to="/customer/create" data-testid="hero-post-clip-btn" className="btn-lime h-13 sm:h-14 px-8 text-base group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">Post a Clip <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" /></span>
            <span className="absolute inset-0 bg-white/30 -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
          </Link>
          <Link to="/marketplace" data-testid="hero-browse-jobs-btn" className="btn-ghost h-13 sm:h-14 px-7 text-base">Browse Live Jobs</Link>
        </motion.div>

        {/* proof strip */}
        <motion.div variants={fadeUp} custom={4} className="grid grid-cols-3 max-w-2xl mx-auto divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden" data-testid="hero-proof">
          {STATS.map(([Icon, big, small]) => (
            <div key={small} className="px-2 sm:px-6 py-5 flex flex-col items-center gap-1">
              <Icon className="w-4 h-4 text-[#CCFF00] mb-1" />
              <span className="font-mono font-extrabold text-lg sm:text-2xl tracking-tighter">{big}</span>
              <span className="text-[10px] sm:text-xs text-zinc-500 leading-tight">{small}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
