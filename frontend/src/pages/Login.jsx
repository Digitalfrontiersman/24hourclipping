import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { homeFor } from "@/lib/roles";
import GoogleButton from "@/components/GoogleButton";

export default function Login() {
  const { login, google, loginDemo } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
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

  const demo = async (role) => {
    try {
      const user = await loginDemo(role);
      toast.success(`Demo ${role}`);
      go(user);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Demo login unavailable");
    }
  };

  const showDemo = process.env.REACT_APP_HIDE_DEMO_LOGIN !== "true";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white grid lg:grid-cols-2">
      {/* LEFT - form */}
      <div className="relative flex items-center justify-center px-4 py-12 overflow-hidden grain">
        {/* radial lime glow so the form doesn't float on pure black */}
        <div className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#CCFF00]/10 blur-[120px]" aria-hidden="true" />
        <div className="relative z-10 w-full max-w-md">
          <Link to="/" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tighter mb-8">
            <span className="w-8 h-8 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-4 h-4 text-black" fill="black" /></span>
            <span>24HR<span className="text-[#CCFF00]">CLIPPING</span></span>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mb-1">Log in</h1>
          <p className="text-sm text-zinc-500 mb-6">Welcome back. Pick up where you left off.</p>

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

          {showDemo && (
            <div className="mt-6 pt-6 border-t border-white/10 text-sm text-zinc-500">
              Just exploring?{" "}
              <button onClick={() => demo("customer")} className="text-zinc-300 font-semibold hover:text-[#CCFF00] transition-colors underline underline-offset-4">Demo Customer</button>
              {" · "}
              <button onClick={() => demo("clipper")} className="text-zinc-300 font-semibold hover:text-[#CCFF00] transition-colors underline underline-offset-4">Demo Clipper</button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT - brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden border-l border-white/10 bg-[#080808] grain p-12">
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rounded-full bg-[#CCFF00]/10 blur-[130px]" aria-hidden="true" />
        <div className="relative z-10">
          <span className="label-caps text-[#CCFF00]">The 24-hour clipping marketplace</span>
        </div>
        <div className="relative z-10">
          <div className="font-mono text-6xl xl:text-7xl font-extrabold tracking-tighter text-white">18h 42m</div>
          <p className="label-caps mt-3">Average first-cut turnaround</p>
          <p className="text-zinc-400 mt-6 max-w-sm leading-relaxed">
            Vetted clippers stake real money behind your deadline. Post the moment, pick your clipper, and get a ready-to-post cut before it gets old - or your money back.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-x-3 gap-y-2 text-sm text-zinc-500 flex-wrap">
          <span>Vetted clippers</span>
          <span className="w-1 h-1 rounded-full bg-[#CCFF00]" />
          <span>Deadline backed</span>
          <span className="w-1 h-1 rounded-full bg-[#CCFF00]" />
          <span>8% success fee</span>
        </div>
      </div>
    </div>
  );
}
