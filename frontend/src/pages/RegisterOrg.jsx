import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function RegisterOrgPage() {
  const { registerOrg } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ org_name: "", owner_name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await registerOrg(form);
      toast.success("Organization registered.");
      nav("/admin", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.detail?.toString?.() || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="label-uppercase hover:text-white transition-colors" data-testid="back-login">← BACK TO SIGN IN</Link>
        <div className="mt-6 label-uppercase">REGISTER ORGANIZATION</div>
        <h2 className="text-2xl font-medium tracking-tight mt-2 mb-6">Deploy the console for your team.</h2>
        <form onSubmit={submit} className="space-y-4" data-testid="register-form">
          {[
            { k: "org_name", label: "Organization Name", type: "text", ph: "Acme Field Services" },
            { k: "owner_name", label: "Your Full Name", type: "text", ph: "Ada Lovelace" },
            { k: "email", label: "Email", type: "email", ph: "you@acme.com" },
            { k: "password", label: "Password (min 8)", type: "password", ph: "••••••••" },
          ].map((f) => (
            <div key={f.k}>
              <label className="label-uppercase block mb-2">{f.label}</label>
              <input
                type={f.type}
                required
                placeholder={f.ph}
                value={form[f.k]}
                onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                data-testid={`register-${f.k}`}
                className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2.5 text-sm mono transition-colors"
              />
            </div>
          ))}
          {err && <div className="text-red-400 text-xs mono border border-red-500/30 bg-red-500/10 p-2" data-testid="register-error">{err}</div>}
          <button
            type="submit"
            disabled={busy}
            data-testid="register-submit"
            className="w-full bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium py-2.5 text-sm transition-colors"
          >{busy ? "Creating…" : "Create organization →"}</button>
        </form>
      </div>
    </div>
  );
}
