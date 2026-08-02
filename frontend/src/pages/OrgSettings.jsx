import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="label-uppercase block mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-gray-500 mono mt-1">{hint}</div>}
    </div>
  );
}

export default function OrgSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["org-settings"],
    queryFn: async () => (await api.get("/org/settings")).data,
  });
  const [form, setForm] = useState({});
  useEffect(() => { if (data?.settings) setForm(data.settings); }, [data]);

  const save = useMutation({
    mutationFn: async () => (await api.patch("/org/settings", {
      session_duration_minutes: Number(form.session_duration_minutes),
      resume_window_hours: Number(form.resume_window_hours),
      accuracy_tolerance_meters: Number(form.accuracy_tolerance_meters),
      max_speed_kmh: Number(form.max_speed_kmh),
      spoof_sensitivity: form.spoof_sensitivity,
      notify_admin_on_spoof: !!form.notify_admin_on_spoof,
    })).data,
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["org-settings"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const Field = ({ label, hint, children }) => (
    <div>
      <label className="label-uppercase block mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-gray-500 mono mt-1">{hint}</div>}
    </div>
  );

  return (
    <AppShell>
      <div className="mb-6">
        <div className="label-uppercase">SETTINGS</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Organization</h1>
        <div className="text-sm text-gray-400 mt-1">{data?.name} · <span className="mono text-xs">{data?.slug}</span></div>
      </div>

      <div className="surface p-6 max-w-3xl" data-testid="settings-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Session Duration (minutes)" hint="Default clock time per session">
            <input type="number" min={1} max={1440} value={form.session_duration_minutes || ""} onChange={(e) => setForm({ ...form, session_duration_minutes: e.target.value })} data-testid="set-session-duration" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
          </Field>
          <Field label="Resume Window (hours)" hint="Time to return after exit before session expires">
            <input type="number" min={1} max={48} value={form.resume_window_hours || ""} onChange={(e) => setForm({ ...form, resume_window_hours: e.target.value })} data-testid="set-resume-window" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
          </Field>
          <Field label="Accuracy Tolerance (meters)" hint="Reject GPS fixes with accuracy > this value">
            <input type="number" min={5} max={500} value={form.accuracy_tolerance_meters || ""} onChange={(e) => setForm({ ...form, accuracy_tolerance_meters: e.target.value })} data-testid="set-accuracy-tol" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
          </Field>
          <Field label="Max Speed (km/h)" hint="Flag consecutive pings above this speed">
            <input type="number" min={10} max={1000} value={form.max_speed_kmh || ""} onChange={(e) => setForm({ ...form, max_speed_kmh: e.target.value })} data-testid="set-max-speed" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
          </Field>
          <Field label="Spoof Sensitivity">
            <select value={form.spoof_sensitivity || "medium"} onChange={(e) => setForm({ ...form, spoof_sensitivity: e.target.value })} data-testid="set-spoof-sens" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Notify Admin on Spoof">
            <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={!!form.notify_admin_on_spoof} onChange={(e) => setForm({ ...form, notify_admin_on_spoof: e.target.checked })} data-testid="set-notify" className="w-4 h-4" />
              <span className="text-sm mono uppercase tracking-widest">EMAIL ALERT</span>
            </label>
          </Field>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10">
          <button onClick={() => save.mutate()} disabled={save.isPending} data-testid="save-settings" className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium px-5 py-2.5 text-sm transition-colors">{save.isPending ? "Saving…" : "Save settings"}</button>
        </div>
      </div>
    </AppShell>
  );
}
