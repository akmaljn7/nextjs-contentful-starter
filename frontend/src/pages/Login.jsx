import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const u = await login(email, password);
      toast.success(`Signed in as ${u.name}`);
      const dest = loc.state?.from || (u.role === "employee" ? "/employee" : "/admin");
      nav(dest, { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.detail?.toString?.() || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1fr_480px]">
      {/* Left visual panel */}
      <div className="hidden lg:block relative overflow-hidden border-r border-white/10">
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 30% 40%, rgba(16,185,129,0.15), transparent 60%), radial-gradient(circle at 70% 70%, rgba(59,130,246,0.08), transparent 60%), #0a0a0a" }} />
        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative z-10 p-14 h-full flex flex-col justify-between">
          <div>
            <div className="label-uppercase" style={{ letterSpacing: "0.28em" }}>STAYPIN</div>
            <h1 className="mt-3 text-4xl xl:text-5xl font-semibold tracking-tight text-white">Verified<br />on-site presence.</h1>
            <p className="mt-4 text-gray-400 max-w-md text-sm leading-relaxed">Server-authoritative geofenced attendance. Live satellite pins, immutable audit history, anti-spoof engine — for teams that need proof, not promises.</p>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="label-uppercase">Session</div>
              <div className="mono text-3xl mt-1">60:00</div>
              <div className="text-xs text-gray-500 mt-1">countdown / pauses on exit</div>
            </div>
            <div>
              <div className="label-uppercase">Radius</div>
              <div className="mono text-3xl mt-1">150 m</div>
              <div className="text-xs text-gray-500 mt-1">configurable per office</div>
            </div>
            <div>
              <div className="label-uppercase">Anti-spoof</div>
              <div className="mono text-3xl mt-1">200 km/h</div>
              <div className="text-xs text-gray-500 mt-1">impossible-speed guard</div>
            </div>
            <div>
              <div className="label-uppercase">Retention</div>
              <div className="mono text-3xl mt-1">SOC2</div>
              <div className="text-xs text-gray-500 mt-1">chained records, TTL pings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="label-uppercase mb-2">SIGN IN</div>
          <h2 className="text-2xl font-medium tracking-tight mb-8">Access your operations console.</h2>
          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="label-uppercase block mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                data-testid="login-email"
                className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2.5 text-sm mono transition-colors"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-uppercase">Password</label>
                <Link to="/forgot-password" className="label-uppercase hover:text-white transition-colors" data-testid="forgot-link">Forgot?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password"
                className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2.5 text-sm mono transition-colors"
              />
            </div>
            {err && <div className="text-red-400 text-xs mono border border-red-500/30 bg-red-500/10 p-2" data-testid="login-error">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              data-testid="login-submit"
              className="w-full bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium py-2.5 text-sm transition-colors"
            >{busy ? "Signing in…" : "Sign in →"}</button>
          </form>
          <div className="mt-8 pt-6 border-t border-white/10 text-xs text-gray-500 mono">
            <div>No account? <Link to="/register" className="text-white underline underline-offset-4" data-testid="register-link">Register your org →</Link></div>
          </div>
          <div className="mt-8 text-[10px] text-gray-600 mono uppercase tracking-widest">Demo credentials seeded — see README</div>
        </div>
      </div>
    </div>
  );
}
