import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Star, ChevronDown } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.09, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function HeroBanner() {
  return (
    <section
      className="relative grain overflow-hidden min-h-[calc(100svh-4rem)] flex items-center justify-center"
      data-testid="hero-banner"
    >
      {/* ambient light — one soft lime bloom + a faint coral, nothing else */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-18%] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[#CCFF00]/[0.09] blur-[160px] hero-glow"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-30%] right-[-10%] h-[34rem] w-[34rem] rounded-full bg-[#FF4500]/[0.04] blur-[150px]"
        aria-hidden="true"
      />

      <motion.div
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto w-full max-w-3xl px-5 sm:px-6 text-center"
      >
        {/* headline */}
        <motion.h1
          variants={fadeUp}
          custom={0}
          className="font-display font-extrabold tracking-tight text-[2rem] leading-[1.18] sm:text-6xl sm:leading-[1.05] lg:text-7xl"
          data-testid="hero-headline"
        >
          Your best moments,
          <br className="hidden sm:block" />{" "}
          clipped in{" "}
          <span className="relative whitespace-nowrap text-[#CCFF00] lime-flicker">24 hours</span>.
        </motion.h1>

        {/* subcopy */}
        <motion.p
          variants={fadeUp}
          custom={1}
          className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg"
        >
          Post the moment, pick a vetted clipper, and get a finished, ready-to-post
          cut back before it gets old — or your money back.
        </motion.p>

        {/* CTAs — stack full-width on mobile, inline on larger */}
        <motion.div
          variants={fadeUp}
          custom={2}
          className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4"
        >
          <Link
            to="/customer/create"
            data-testid="hero-post-clip-btn"
            className="btn-lime group relative h-14 w-full overflow-hidden px-8 text-base sm:w-auto"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              Post a Clip
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
            </span>
            <span className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full" />
          </Link>
          <Link
            to="/marketplace"
            data-testid="hero-browse-jobs-btn"
            className="btn-ghost h-14 w-full px-7 text-base sm:w-auto"
          >
            Browse Live Jobs
          </Link>
        </motion.div>

        {/* trust line */}
        <motion.div
          variants={fadeUp}
          custom={3}
          className="mt-10 flex flex-col items-center justify-center gap-1.5 text-sm text-zinc-500 sm:flex-row sm:gap-3"
        >
          <span className="flex items-center gap-1 text-[#CCFF00]">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5" fill="#CCFF00" strokeWidth={0} />
            ))}
            <span className="ml-1 font-bold text-white">4.9</span>
          </span>
          <span className="hidden text-zinc-700 sm:inline">·</span>
          <span>200+ clips delivered on deadline</span>
        </motion.div>
      </motion.div>

      {/* scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2"
        aria-hidden="true"
      >
        <ChevronDown className="h-5 w-5 animate-bounce text-zinc-600" />
      </motion.div>
    </section>
  );
}
