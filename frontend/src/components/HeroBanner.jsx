import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] } }),
};

export default function HeroBanner() {
  return (
    <section className="relative grain overflow-hidden min-h-[calc(100svh-4rem)] flex items-center justify-center" data-testid="hero-banner">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-[12%] left-1/2 -translate-x-1/2 w-[64rem] h-[40rem] rounded-full bg-[#CCFF00]/[0.07] blur-[150px]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-[-25%] right-[-8%] w-[38rem] h-[38rem] rounded-full bg-[#CCFF00]/[0.04] blur-[130px]" aria-hidden="true" />

      <motion.div initial="hidden" animate="show" className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.h1 variants={fadeUp} custom={0} className="font-display font-extrabold tracking-tight leading-[1.02] text-5xl sm:text-6xl lg:text-7xl mb-7" data-testid="hero-headline">
          Your best moments,<br className="hidden sm:block" /> clipped in <span className="text-[#CCFF00]">24 hours</span>.
        </motion.h1>

        <motion.p variants={fadeUp} custom={1} className="text-zinc-400 text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto mb-10">
          Post the moment, pick a vetted clipper, and get a finished, ready-to-post clip before it gets old.
        </motion.p>

        <motion.div variants={fadeUp} custom={2} className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
          <Link to="/customer/create" data-testid="hero-post-clip-btn" className="btn-lime h-13 sm:h-14 px-8 text-base group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">Post a Clip <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5" /></span>
            <span className="absolute inset-0 bg-white/30 -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
          </Link>
          <Link to="/marketplace" data-testid="hero-browse-jobs-btn" className="btn-ghost h-13 sm:h-14 px-7 text-base">Browse Live Jobs</Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
