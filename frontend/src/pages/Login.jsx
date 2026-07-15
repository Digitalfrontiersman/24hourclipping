import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Clock, Zap } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { homeFor } from "@/lib/roles";
import GoogleButton from "@/components/GoogleButton";

export default function Login() {
  const { login, resendVerification, google } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(false);

  const go = (user) => {
    // Unonboarded users always go through the wizard first.
    const dest = !user.onboarded ? "/onboarding" : (loc.state?.from || homeFor(user));
    nav(dest, { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login({ email, password });
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      go(user);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 403 && detail === "email_not_verified") {
        setUnverified(true);
      } else {
        toast.error(typeof detail === "string" ? detail : "Login failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await resendVerification(email);
      toast.success("Verification email sent");
    } catch {
      toast.error("Could not resend right now, try again shortly");
    }
  };

  const onGoogle = async (credential) => {
    try {
      const user = await google({ credential });
      toast.success(`Signed in as ${user.name}`);
      go(user);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Google sign-in failed");
    }
  };


  return (
    <div className="min-h-[calc(100svh-4rem)] bg-[#0A0A0A] text-white grid lg:grid-cols-2">
      {/* LEFT - form */}
      <div className="relative flex items-center justify-center px-4 py-8 overflow-hidden grain">
        {/* radial lime glow so the form doesn't float on pure black */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#CCFF00]/10 blur-[120px]" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-sm">
          {/* brand lockup - mobile only (the right brand panel is hidden below lg) */}
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 font-display font-extrabold text-lg tracking-tighter mb-8">
            <span className="w-8 h-8 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-4 h-4 text-black" fill="black" /></span>
            <span>24HR<span className="text-[#CCFF00]">CLIPPING</span></span>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mb-1">Log in</h1>
          <p className="text-sm text-zinc-500 mb-6">Welcome back. Pick up where you left off.</p>

          {unverified && (
            <div data-testid="login-unverified" className="mb-4 rounded-xl border border-[#FF4500]/30 bg-[#FF4500]/[0.06] p-4">
              <p className="text-sm font-bold text-white mb-1">Verify your email first</p>
              <p className="text-xs text-zinc-400 mb-3">We sent a link to {email}. Click it to activate your account, then log in.</p>
              <button type="button" onClick={resend} data-testid="login-resend" className="btn-ghost h-9 px-4 text-xs">Resend verification email</button>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            <input data-testid="login-email" className="input-dark" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input data-testid="login-password" className="input-dark" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button data-testid="login-submit" disabled={busy} className="btn-lime w-full h-12 justify-center">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Log in
            </button>
          </form>

          <div className="my-5"><GoogleButton onCredential={onGoogle} /></div>

          <div className="text-sm text-zinc-500">
            No account? <Link to="/register" className="text-[#CCFF00] font-semibold">Sign up</Link>
          </div>

        </div>
      </div>

      {/* RIGHT - brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden border-l border-white/10 bg-gradient-to-br from-[#0c0c0c] via-[#0a0a0a] to-[#070707] grain p-12 xl:p-16">
        <div className="pointer-events-none absolute -top-28 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#CCFF00]/[0.08] blur-[120px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[30rem] w-[30rem] rounded-full bg-[#CCFF00]/[0.05] blur-[130px]" aria-hidden="true" />

        <div className="relative z-10">
          <span className="label-caps">The 24-hour clipping marketplace</span>
        </div>

        <div className="relative z-10">
          <h2 className="font-display font-extrabold text-4xl xl:text-5xl leading-[1.05] tracking-tight">
            Your best moments,<br /><span className="text-[#CCFF00]">clipped in 24 hours.</span>
          </h2>
          <div className="mt-8 inline-flex items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)]">
            <Clock className="w-5 h-5 text-[#CCFF00] mb-1.5" />
            <span className="font-mono text-3xl font-extrabold tracking-tighter leading-none">18h 42m</span>
            <span className="text-xs text-zinc-500 mb-1">avg turnaround</span>
          </div>
        </div>

        <div className="relative z-10 space-y-3">
          {[
            "Vetted clippers who stake real money on your deadline",
            "A ready-to-post cut before the moment gets old",
            "Only pay when you approve - 8% success fee",
          ].map((t) => (
            <div key={t} className="flex items-start gap-2.5 text-sm text-zinc-400">
              <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0 mt-0.5" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
