import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { homeFor } from "@/lib/roles";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { verifyEmail } = useApp();
  const nav = useNavigate();
  const token = params.get("token");
  const [state, setState] = useState("verifying"); // verifying | ok | error
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState("error"); return; }
    verifyEmail(token)
      .then((u) => {
        setState("ok");
        setTimeout(() => nav(!u.onboarded ? "/onboarding" : homeFor(u), { replace: true }), 1100);
      })
      .catch(() => setState("error"));
  }, [token, verifyEmail, nav]);

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-[#0A0A0A] text-white flex items-center justify-center px-4 py-10 relative overflow-hidden grain">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[28rem] w-[28rem] rounded-full bg-[#CCFF00]/10 blur-[120px]" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm text-center card-dark p-8">
        {state === "verifying" && (
          <>
            <Loader2 className="w-10 h-10 text-[#CCFF00] mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-extrabold tracking-tighter mb-1">Verifying your email…</h1>
            <p className="text-sm text-zinc-500">Hang tight, this only takes a second.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-11 h-11 text-[#CCFF00] mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold tracking-tighter mb-1">Email verified</h1>
            <p className="text-sm text-zinc-500">You're all set. Taking you in…</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="w-11 h-11 text-[#FF4500] mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold tracking-tighter mb-1">Link invalid or expired</h1>
            <p className="text-sm text-zinc-500 mb-6">This verification link isn't valid anymore. Log in to get a fresh one sent to your inbox.</p>
            <Link to="/login" className="btn-lime h-11 px-6 text-sm w-full">Go to login</Link>
          </>
        )}
      </div>
    </div>
  );
}
