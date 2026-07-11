import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import GoogleButton from "@/components/GoogleButton";

const ROLE_HOME = { customer: "/customer", clipper: "/clipper" };

export default function Register() {
  const { register, google } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [busy, setBusy] = useState(false);

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
      nav(ROLE_HOME[user.role] || "/", { replace: true });
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
      nav(ROLE_HOME[user.role] || "/", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Google sign-in failed");
    }
  };

  const roleBtn = (r, label) => (
    <button type="button" onClick={() => setRole(r)}
      className={`flex-1 h-11 rounded-xl text-sm font-bold border transition-colors ${role === r ? "bg-[#CCFF00] text-black border-[#CCFF00]" : "border-white/15 text-zinc-300 hover:border-white/30"}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md card-dark p-8">
        <Link to="/" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tighter mb-8">
          <span className="w-8 h-8 rounded-full bg-[#CCFF00] flex items-center justify-center"><Zap className="w-4 h-4 text-black" fill="black" /></span>
          <span>24HR<span className="text-[#CCFF00]">CLIPPING</span></span>
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tighter mb-1">Create your account</h1>
        <p className="text-sm text-zinc-500 mb-6">Join as a customer posting clips, or a clipper delivering them.</p>

        <div className="flex gap-2 mb-4">
          {roleBtn("customer", "I need clips")}
          {roleBtn("clipper", "I make clips")}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input data-testid="register-name" className="input-dark" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input data-testid="register-email" className="input-dark" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input data-testid="register-password" className="input-dark" type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button data-testid="register-submit" disabled={busy} className="btn-lime w-full h-12 justify-center">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
          </button>
        </form>

        <div className="my-5"><GoogleButton onCredential={onGoogle} /></div>

        <div className="text-sm text-zinc-500 text-center">
          Already have an account? <Link to="/login" className="text-[#CCFF00] font-semibold">Log in</Link>
        </div>
      </div>
    </div>
  );
}
