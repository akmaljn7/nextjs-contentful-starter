import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api, toApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setErr("Passwords don't match"); return; }
    setBusy(true); setErr("");
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reset. Sign in with your new password.");
      nav("/login", { replace: true });
    } catch (e) { setErr(toApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link to="/login" className="label-uppercase hover:text-white transition-colors" data-testid="back-login">← BACK</Link>
        <div className="mt-6 label-uppercase">SET NEW PASSWORD</div>
        <h2 className="text-2xl font-medium tracking-tight mt-2 mb-6">Choose something strong.</h2>
        {!token && <div className="border border-red-500/30 bg-red-500/10 p-3 text-xs mono mb-4">MISSING TOKEN</div>}
        <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
          <div>
            <label className="label-uppercase block mb-2">New Password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2.5 text-sm mono" />
          </div>
          <div>
            <label className="label-uppercase block mb-2">Confirm</label>
            <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="reset-confirm" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2.5 text-sm mono" />
          </div>
          {err && <div className="text-red-400 text-xs mono border border-red-500/30 bg-red-500/10 p-2">{err}</div>}
          <button type="submit" disabled={busy || !token} data-testid="reset-submit" className="w-full bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium py-2.5 text-sm transition-colors">{busy ? "Resetting…" : "Reset password →"}</button>
        </form>
      </div>
    </div>
  );
}
