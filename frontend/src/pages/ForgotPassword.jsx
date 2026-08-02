import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, toApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("If this email exists, a reset link has been sent.");
    } catch (e) { setErr(toApiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link to="/login" className="label-uppercase hover:text-white transition-colors" data-testid="back-login">← BACK</Link>
        <div className="mt-6 label-uppercase">PASSWORD RESET</div>
        <h2 className="text-2xl font-medium tracking-tight mt-2 mb-6">Recover access.</h2>
        {sent ? (
          <div className="border border-green-500/30 bg-green-500/10 p-4 text-sm" data-testid="reset-sent">
            <div className="mono text-xs uppercase tracking-widest text-green-400 mb-2">Sent</div>
            Check your inbox — the reset link expires in 1 hour.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
            <div>
              <label className="label-uppercase block mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="forgot-email"
                className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2.5 text-sm mono transition-colors"
              />
            </div>
            {err && <div className="text-red-400 text-xs mono border border-red-500/30 bg-red-500/10 p-2">{err}</div>}
            <button
              type="submit"
              disabled={busy}
              data-testid="forgot-submit"
              className="w-full bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium py-2.5 text-sm transition-colors"
            >{busy ? "Sending…" : "Send reset link →"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
