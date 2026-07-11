import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Timer, Shield, Zap, Play, Mic2, Video, Briefcase, TrendingUp } from "lucide-react";
import Footer from "@/components/Footer";
import ClipperCard from "@/components/ClipperCard";
import { DEMO_VIDEOS } from "@/data/demoVideos";
import { dbAdapter } from "@/services/dbAdapter";

const LIVE_BIDS = [
  { name: "Maya T.", amount: 78, job: "Ranked Finals Clutch", avatar: "https://i.pravatar.cc/150?img=12" },
  { name: "Lena O.", amount: 45, job: "IRL Fail Compilation", avatar: "https://i.pravatar.cc/150?img=5" },
  { name: "Devon R.", amount: 110, job: "Founder Burnout Pod", avatar: "https://i.pravatar.cc/150?img=32" },
  { name: "Sasha I.", amount: 240, job: "Launch Teaser Ad", avatar: "https://i.pravatar.cc/150?img=47" },
  { name: "Rio A.", amount: 62, job: "SaaS Demo Short", avatar: "https://i.pravatar.cc/150?img=15" },
];

const USE_CASES = [
  { icon: Video, title: "Streamers", desc: "Turn 4-hour VODs into daily viral moments while you sleep." },
  { icon: Mic2, title: "Podcasters", desc: "Every episode becomes a week of shorts, reels and TikToks." },
  { icon: TrendingUp, title: "Creators & Influencers", desc: "Post more, edit never. Keep the algorithm fed." },
  { icon: Briefcase, title: "Entrepreneurs & Businesses", desc: "Founder clips and product ads without an agency retainer." },
];

const STEPS = [
  { n: "01", title: "Post your footage", desc: "Upload or paste a link. Tell us the moment — or let clippers find it." },
  { n: "02", title: "Watch bids arrive live", desc: "Trusted clippers compete in real time. Pick by rating, speed and fit." },
  { n: "03", title: "First cut in 24 hours", desc: "The clock starts at Contract Live. Miss it and you get your money back." },
];

export default function Landing() {
  const [bidIdx, setBidIdx] = useState(0);
  const [clippers, setClippers] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setBidIdx((i) => (i + 1) % LIVE_BIDS.length), 2800);
    dbAdapter.getClippers().then((c) => setClippers(c.slice(0, 3))).catch(() => {});
    return () => clearInterval(t);
  }, []);

  const visible = [0, 1, 2].map((o) => LIVE_BIDS[(bidIdx + o) % LIVE_BIDS.length]);

  return (
    <div className="bg-[#0A0A0A] text-white">
      {/* HERO */}
      <section className="relative grain overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 lg:pt-24 lg:pb-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="label-caps text-[#CCFF00] mb-6">The marketplace for 24-hour clips</div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-none mb-6">
              Turn Your Best Moments Into <span className="text-[#CCFF00]">Finished Clips</span> in 24 Hours.
            </h1>
            <p className="text-lg text-zinc-400 max-w-xl mb-8 leading-relaxed">
              Post your footage, and vetted clippers compete to edit it. Pick the bid you like and get your first cut back within a day.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/customer/create" data-testid="hero-post-clip-btn" className="btn-lime h-14 px-8 text-base">Post a Clip <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/clipper/onboarding" data-testid="hero-become-clipper-btn" className="btn-ghost h-14 px-8 text-base">Become a Clipper</Link>
            </div>
            <p className="mt-8 text-xs text-zinc-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#CCFF00] to-emerald-400" /> Payments powered by Solana · 8% success fee only when you're happy
            </p>
          </div>

          {/* Animated live marketplace preview */}
          <div className="lg:col-span-5">
            <div className="card-dark p-5" data-testid="live-marketplace-preview">
              <div className="flex items-center justify-between mb-4">
                <span className="label-caps">Clippers competing for a brief</span>
              </div>
              <div className="space-y-3 min-h-[240px]">
                <AnimatePresence mode="popLayout">
                  {visible.map((b) => (
                    <motion.div key={b.name + b.job} layout initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-3 bg-black/50 rounded-xl p-3 border border-white/5">
                      <img src={b.avatar} alt={b.name} className="w-10 h-10 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold">{b.name} <span className="text-zinc-500 font-normal">bid on</span></div>
                        <div className="text-xs text-zinc-400 truncate">{b.job}</div>
                      </div>
                      <div className="font-mono font-extrabold text-[#CCFF00]">${b.amount}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-zinc-500">First cut delivered</span>
                <span className="font-mono font-bold text-white">within 24 hours</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO VIDEO CAROUSEL */}
      <section className="py-16 border-t border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
          <span className="label-caps">Made on Clip24</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-2">Clips that stopped the scroll.</h2>
        </div>
        <div className="flex gap-6 animate-marquee w-max px-4" data-testid="demo-video-carousel">
          {[...DEMO_VIDEOS, ...DEMO_VIDEOS].map((v, i) => (
            <div key={i} className="relative w-72 shrink-0 rounded-2xl overflow-hidden border border-white/10 group cursor-pointer">
              <img src={v.thumb} alt={v.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                <div>
                  <div className="font-display font-bold text-sm">{v.title}</div>
                  <div className="text-xs text-[#CCFF00]">{v.stat}</div>
                </div>
                <span className="w-9 h-9 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><Play className="w-4 h-4" fill="white" /></span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <span className="label-caps">How it works</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-2 mb-12">Three steps. Zero friction.</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="card-dark p-8 hover:border-[#CCFF00]/40 transition-colors">
                <div className="font-mono text-5xl font-extrabold text-[#CCFF00]/20 mb-4">{s.n}</div>
                <h3 className="font-display font-bold text-xl mb-2">{s.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 24H GUARANTEE */}
      <section className="py-20 border-t border-white/10 bg-[#121212]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="label-caps text-[#FF4500]">The accountability guarantee</span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-2 mb-6">24 hours. On the clock. <span className="text-[#FF4500]">Or your money back.</span></h2>
            <ul className="space-y-4 text-zinc-300">
              {[
                ["Deadline Bond", "Every clipper locks real money behind your deadline before the clock starts."],
                ["Contract Live", "Funded, accepted, footage ready — the visible 24-hour countdown begins."],
                ["Rescue Mode", "Deadline missed? Full refund plus the clipper's bond credited to you. Relaunch as a priority job instantly."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4">
                  <Shield className="w-5 h-5 text-[#CCFF00] shrink-0 mt-0.5" />
                  <div><span className="font-bold text-white">{t}.</span> <span className="text-zinc-400">{d}</span></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card-dark p-8 text-center">
            <span className="label-caps">Demo countdown</span>
            <div className="font-mono text-6xl sm:text-7xl font-extrabold tracking-tighter text-[#FF4500] my-6 heartbeat">18:24:07</div>
            <div className="flex justify-center gap-8 text-xs text-zinc-500 uppercase tracking-widest"><span>Hours</span><span>Minutes</span><span>Seconds</span></div>
            <div className="mt-6 badge-live mx-auto w-fit"><Timer className="w-3.5 h-3.5" /> CONTRACT LIVE</div>
          </div>
        </div>
      </section>

      {/* TRUSTED CLIPPERS */}
      <section className="py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <span className="label-caps">Trusted clippers</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-2">Vetted. Rated. On time.</h2>
            </div>
            <Link to="/clippers" data-testid="landing-view-clippers-btn" className="btn-ghost h-11 px-6 text-sm">View directory <ArrowRight className="w-4 h-4" /></Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {clippers.map((c) => <ClipperCard key={c.id} clipper={c} />)}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <span className="label-caps">Built for</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mt-2 mb-12">Whoever's on camera. We handle the cut.</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {USE_CASES.map((u) => (
              <div key={u.title} className="card-dark p-6 hover:border-white/25 transition-colors">
                <u.icon className="w-7 h-7 text-[#CCFF00] mb-4" />
                <h3 className="font-display font-bold mb-2">{u.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEE */}
      <section className="py-20 border-t border-white/10 bg-[#121212]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="font-mono text-7xl font-extrabold text-[#CCFF00] mb-4">8%</div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">One simple success fee.</h2>
          <p className="text-zinc-400 leading-relaxed">We only earn when your project is completed and you approve the clip. No subscriptions, no listing fees, no surprises. Bidding is always free.</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 border-t border-white/10 relative grain">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Zap className="w-10 h-10 text-[#CCFF00] mx-auto mb-6" fill="#CCFF00" />
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tighter mb-6">The moment is fresh right now.<br />It won't be tomorrow.</h2>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/customer/create" data-testid="final-cta-post-clip" className="btn-lime h-14 px-10 text-base">Post a Clip <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/marketplace" data-testid="final-cta-browse-jobs" className="btn-white h-14 px-10 text-base">Browse Live Jobs</Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
