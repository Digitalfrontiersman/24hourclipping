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

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md card-dark p-8">
        <Link to="/" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tighter mb-8">
          <span className="w-8 h-8 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-4 h-4 text-black" fill="black" /></span>
          <span>24HR<span className="text-[#CCFF00]">CLIPPING</span></span>
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tighter mb-1">Log in</h1>
        <p className="text-sm text-zinc-500 mb-6">Welcome back. Pick up where you left off.</p>

        <form onSubmit={submit} className="space-y-3">
          <input data-testid="login-email" className="input-dark" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input data-testid="login-password" className="input-dark" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button data-testid="login-submit" disabled={busy} className="btn-lime w-full h-12 justify-center">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log in"}
          </button>
        </form>

        <div className="my-5"><GoogleButton onCredential={onGoogle} /></div>

        <div className="text-sm text-zinc-500 text-center">
          No account? <Link to="/register" className="text-[#CCFF00] font-semibold">Sign up</Link>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-zinc-600 mb-2 text-center">Just exploring? Try a demo account</p>
          <div className="flex gap-2">
            <button onClick={() => demo("customer")} className="btn-ghost flex-1 h-9 text-xs">Demo Customer</button>
            <button onClick={() => demo("clipper")} className="btn-ghost flex-1 h-9 text-xs">Demo Clipper</button>
          </div>
        </div>
      </div>
    </div>
  );
}
