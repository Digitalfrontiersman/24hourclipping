import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { homeFor } from "@/lib/roles";
import GoogleButton from "@/components/GoogleButton";

export default function Register() {
  const { register, google } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Optional ?role=clipper|customer hint (default customer). When present we know
  // the side, so we forward it to onboarding to skip the "which side?" question.
  const roleParam = params.get("role") === "clipper" ? "clipper" : params.get("role") === "customer" ? "customer" : null;
  const role = roleParam || "customer";

  // After auth, honour the role hint through onboarding when we're headed there.
  const go = (user) => {
    const dest = homeFor(user);
    nav(roleParam && dest === "/onboarding" ? `/onboarding?role=${roleParam}` : dest, { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const user = await register({ name, email, password, role });
      toast.success(`Welcome, ${user.name.split(" ")[0]}!`);
      go(user); // → onboarding
    } catch (err) {
      toast.error(err.response?.data?.detail || "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential) => {
    try {
      const user = await google({ credential, role });
      toast.success(`Welcome, ${user.name}!`);
      go(user);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Google sign-in failed");
    }
  };

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-[#0A0A0A] text-white grid lg:grid-cols-2">
      {/* LEFT - form */}
      <div className="relative flex items-center justify-center px-4 py-10 overflow-hidden grain">
        <div className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#CCFF00]/10 blur-[120px]" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-sm">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mb-1">Create your account</h1>
          <p className="text-sm text-zinc-500 mb-6">One account. Set up as a creator, a clipper, or both in a few quick steps.</p>

          <form onSubmit={submit} className="space-y-3">
            <input data-testid="register-name" className="input-dark" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input data-testid="register-email" className="input-dark" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input data-testid="register-password" className="input-dark" type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button data-testid="register-submit" disabled={busy} className="btn-lime w-full h-12 justify-center">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
            </button>
          </form>

          <div className="my-5"><GoogleButton onCredential={onGoogle} /></div>

          <div className="text-sm text-zinc-500">
            Already have an account? <Link to="/login" className="text-[#CCFF00] font-semibold">Log in</Link>
          </div>
        </div>
      </div>

      {/* RIGHT - brand panel (matches Login) */}
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
