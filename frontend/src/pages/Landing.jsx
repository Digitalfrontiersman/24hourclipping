import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck, Zap, Play, Mic2, Video, Briefcase, TrendingUp, LifeBuoy } from "lucide-react";
import Footer from "@/components/Footer";
import HeroBanner from "@/components/HeroBanner";
import ClipperCard from "@/components/ClipperCard";
import SectionHeading from "@/components/SectionHeading";
import Countdown from "@/components/Countdown";
import { DEMO_VIDEOS } from "@/data/demoVideos";
import { dbAdapter } from "@/services/dbAdapter";

const USE_CASES = [
  { icon: Video, title: "Streamers", desc: "Turn 4-hour VODs into daily viral moments while you sleep." },
  { icon: Mic2, title: "Podcasters", desc: "Every episode becomes a week of shorts, reels and TikToks." },
  { icon: TrendingUp, title: "Creators & Influencers", desc: "Post more, edit never. Keep the algorithm fed." },
  { icon: Briefcase, title: "Entrepreneurs & Businesses", desc: "Founder clips and product ads without an agency retainer." },
];

const STEPS = [
  { n: "01", title: "Post your footage", desc: "Upload or paste a link. Tell us the moment - or let clippers find it." },
  { n: "02", title: "Watch bids arrive live", desc: "Trusted clippers compete in real time. Pick by rating, speed and fit." },
  { n: "03", title: "First cut in 24 hours", desc: "The clock starts at Contract Live. Miss it and you get your money back." },
];

export default function Landing() {
  const [clippers, setClippers] = useState([]);
  // Real, ticking demo countdown ~18h out (computed once so it doesn't reset on re-render).
  const guaranteeDeadline = useMemo(() => new Date(Date.now() + 18 * 3600 * 1000), []);

  useEffect(() => {
    dbAdapter.getClippers().then((c) => setClippers(c.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div className="bg-[#0A0A0A] text-white">
      {/* HERO */}
      <HeroBanner />

      {/* CLIP SHOWCASE */}
      <section className="relative border-t border-white/10 bg-[#080808] py-20 grain overflow-hidden">
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading
            align="center"
            className="mb-12"
            eyebrow="Real work"
            title="Real clips. Real creators."
            sub={<>Short-form clips delivered on 24 Hour Clipping - raw footage in, scroll-stopping cut out.</>}
          />
          <div className="flex flex-wrap justify-center gap-6">
            {["/showcase/clip1.mp4", "/showcase/clip2.mp4"].map((clip) => (
              <div key={clip} className="relative w-[260px] rounded-3xl overflow-hidden border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
                <video
                  src={clip}
                  className="w-full aspect-[9/16] object-cover bg-black pointer-events-none"
                  autoPlay muted loop playsInline preload="metadata"
                  disablePictureInPicture
                  controlsList="nofullscreen nodownload noplaybackrate"
                />
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/marketplace" data-testid="showcase-see-job" className="btn-lime h-12 px-8">Browse live jobs <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>

      {/* DEMO VIDEO CAROUSEL */}
      <section className="py-16 border-t border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
          <SectionHeading eyebrow="Made on 24 Hour Clipping" title="Clips that stopped the scroll." />
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
      <section id="how-it-works" className="py-20 border-t border-white/10 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <SectionHeading className="mb-12" eyebrow="How it works" title="Three steps. Zero friction." />
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <SectionHeading
              className="mb-8"
              eyebrow="The accountability guarantee"
              title={<>24 hours. On the clock. <span className="text-[#FF4500]">Or your money back.</span></>}
            />
            <ul className="space-y-5">
              {[
                [ShieldCheck, "Deadline Bond", "Every clipper locks real money behind your deadline before the clock starts."],
                [Zap, "Contract Live", "Funded, accepted, footage ready - the visible 24-hour countdown begins."],
                [LifeBuoy, "Rescue Mode", "Miss the deadline and you get a full refund plus the clipper's bond, and can relaunch as a priority job instantly."],
              ].map(([Icon, t, d]) => (
                <li key={t} className="flex gap-4">
                  <span className="w-10 h-10 rounded-xl bg-[#CCFF00]/[0.08] border border-[#CCFF00]/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#CCFF00]" />
                  </span>
                  <div>
                    <div className="font-display font-bold text-white">{t}</div>
                    <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Live contract widget */}
          <div className="relative card-dark p-8 overflow-hidden shadow-[0_0_0_1px_rgba(204,255,0,0.14),0_30px_80px_-30px_rgba(204,255,0,0.18)]">
            <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#CCFF00]/[0.06] blur-[90px]" aria-hidden="true" />
            <div className="relative z-10 flex items-center justify-between mb-8">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CCFF00]/30 bg-[#CCFF00]/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#CCFF00]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" /> Contract Live
              </span>
              <span className="text-xs text-zinc-600 font-mono">#CLIP-2481</span>
            </div>
            <div className="relative z-10 text-center">
              <Countdown size="lg" deadline={guaranteeDeadline} />
              <p className="label-caps mt-4 text-zinc-500">Left to deliver the first cut</p>
            </div>
            <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-zinc-600">Deadline bond</div>
                <div className="font-mono font-bold text-[#CCFF00] mt-0.5">$120 locked</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest text-zinc-600">If it's missed</div>
                <div className="font-bold text-[#FF4500] mt-0.5">Refund + bond to you</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUSTED CLIPPERS */}
      <section className="py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <SectionHeading eyebrow="Trusted clippers" title="Vetted. Rated. On time." />
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
          <SectionHeading className="mb-12" eyebrow="Built for" title="Whoever's on camera. We handle the cut." />
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

      {/* WHICH SIDE ARE YOU ON */}
      <section className="relative border-t border-white/10 bg-[#080808] py-20 sm:py-24 grain overflow-hidden">
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
          <SectionHeading align="center" className="mb-12" title="Which side are you on?" />
          <div className="grid md:grid-cols-2 gap-6">
            <Link to="/customer/create" data-testid="side-need-clip" className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#161616] to-black p-8 sm:p-12 min-h-[320px] flex flex-col justify-between hover:border-[#CCFF00]/60 transition-colors">
              <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#CCFF00]/10 blur-3xl group-hover:bg-[#CCFF00]/25 transition-colors" />
              <div className="relative">
                <span className="label-caps text-[#CCFF00]">For creators</span>
                <h3 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter mt-3">I need a clip</h3>
                <p className="text-zinc-400 mt-4 max-w-sm leading-relaxed">Post your footage and vetted clippers compete to edit it - your first cut back in 24 hours.</p>
              </div>
              <span className="relative inline-flex items-center gap-2 mt-8 h-13 w-fit rounded-full bg-[#CCFF00] px-7 py-3.5 font-bold text-black">Post a project <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </Link>
            <Link to="/register" data-testid="side-make-clips" className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#161616] to-black p-8 sm:p-12 min-h-[320px] flex flex-col justify-between hover:border-white/50 transition-colors">
              <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/5 blur-3xl group-hover:bg-white/15 transition-colors" />
              <div className="relative">
                <span className="label-caps">For clippers</span>
                <h3 className="font-display font-extrabold text-4xl sm:text-5xl tracking-tighter mt-3">I make clips</h3>
                <p className="text-zinc-400 mt-4 max-w-sm leading-relaxed">Bid on live jobs, ship scroll-stopping edits, and get paid - 92% yours, on Solana.</p>
              </div>
              <span className="relative inline-flex items-center gap-2 mt-8 h-13 w-fit rounded-full bg-white px-7 py-3.5 font-bold text-black group-hover:bg-zinc-200 transition-colors">Apply as a clipper <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></span>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
