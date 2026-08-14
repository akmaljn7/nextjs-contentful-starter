import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { Camera, Check, Image as ImageIcon, ShieldCheck, ShieldX, Clock, WifiOff, BatteryLow } from "lucide-react";

const STATUSES = ["flagged", "verified", "missed", "mismatch", "all"];

function fmtDT(ms) {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}
function pct(f) { return f == null ? "—" : `${Math.round(f * 100)}%`; }

const STATUS_META = {
  verified: { cls: "border-green-500/40 text-green-400", icon: ShieldCheck, label: "verified" },
  mismatch: { cls: "border-red-500/40 text-red-400", icon: ShieldX, label: "mismatch" },
  no_face: { cls: "border-red-500/40 text-red-400", icon: ShieldX, label: "no face" },
  missed: { cls: "border-red-500/40 text-red-400", icon: WifiOff, label: "missed (offline)" },
  invalid_photo: { cls: "border-amber-500/40 text-amber-400", icon: ShieldX, label: "invalid photo" },
  no_baseline: { cls: "border-gray-500/40 text-gray-400", icon: ShieldX, label: "no baseline" },
};

function SelfiePhoto({ id }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/offline-selfies/${id}/photo`, { responseType: "blob" });
      setUrl(URL.createObjectURL(res.data));
    } catch (e) { toast.error(toApiError(e)); }
    finally { setLoading(false); }
  };
  if (url) return <img src={url} alt="offline selfie" className="mt-2 max-h-48 border border-white/10" data-testid={`offline-selfie-img-${id}`} />;
  return (
    <button onClick={load} disabled={loading} data-testid={`offline-selfie-view-${id}`}
      className="mt-2 inline-flex items-center gap-1.5 text-xs border border-white/10 hover:border-white/30 px-2 py-1 mono text-gray-300">
      <ImageIcon size={13} /> {loading ? "Loading…" : "View selfie"}
    </button>
  );
}

export default function OfflineSelfies() {
  const [status, setStatus] = useState("flagged");
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["offline-selfies", status],
    queryFn: () => api.get(`/offline-selfies?status=${status}`).then((r) => r.data),
    refetchInterval: 15000,
  });

  const review = useMutation({
    mutationFn: (id) => api.post(`/offline-selfies/${id}/review`).then((r) => r.data),
    onSuccess: () => { toast.success("Marked reviewed"); qc.invalidateQueries({ queryKey: ["offline-selfies"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  return (
    <AppShell>
      <div className="space-y-6" data-testid="offline-selfies-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="label-uppercase text-gray-500">Attendance Integrity</div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Camera size={20} className="text-green-400" /> Offline Selfie Checks
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Selfies the phone fired on its own at random times — even with no internet. Verified on our servers the moment the phone reconnects.
            </p>
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} data-testid={`offline-selfie-filter-${s}`}
                className={`px-3 py-1.5 text-xs uppercase tracking-widest font-mono border ${status === s ? "border-green-500 text-white" : "border-white/10 text-gray-400 hover:text-white"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="label-uppercase text-gray-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="surface p-10 text-center text-gray-500" data-testid="offline-selfie-empty">
            <Check size={28} className="mx-auto mb-3 text-green-500" />
            No {status !== "all" ? status : ""} offline selfies.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((s) => {
              const meta = STATUS_META[s.status] || { cls: "border-white/10 text-gray-400", icon: Camera, label: s.status };
              const Icon = meta.icon;
              return (
                <div key={s.id} className="surface p-4 space-y-3" data-testid={`offline-selfie-card-${s.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.employee_name}</div>
                      <div className="text-xs text-gray-500 mono">{s.employee_email}</div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest mono px-2 py-1 border inline-flex items-center gap-1 ${meta.cls}`}
                      data-testid={`offline-selfie-status-${s.id}`}>
                      <Icon size={11} /> {meta.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs mono text-gray-400">
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> fired {fmtDT(s.scheduled_ms)}</span>
                    {s.captured_ms
                      ? <span className="inline-flex items-center gap-1 text-gray-300">captured {fmtDT(s.captured_ms)}</span>
                      : <span className="inline-flex items-center gap-1 text-red-300"><WifiOff size={12} /> never taken</span>}
                  </div>

                  <div className="flex items-center gap-3 text-xs mono text-gray-400">
                    {s.similarity != null && (
                      <span className={s.match ? "text-green-400" : "text-red-400"}>similarity {s.similarity.toFixed(2)}</span>
                    )}
                    {s.battery != null && (
                      <span className="inline-flex items-center gap-1"><BatteryLow size={12} /> {pct(s.battery)}</span>
                    )}
                  </div>

                  {s.has_photo && <SelfiePhoto id={s.id} />}

                  <div className="flex items-center justify-between pt-1">
                    {s.reviewed
                      ? <span className="text-[10px] text-gray-500 mono">Reviewed by {s.reviewed_by}</span>
                      : <span />}
                    {!s.reviewed && (
                      <button onClick={() => review.mutate(s.id)} disabled={review.isPending}
                        data-testid={`offline-selfie-review-${s.id}`}
                        className="inline-flex items-center gap-1.5 border border-white/10 hover:border-green-500/40 hover:text-green-400 px-3 py-1.5 text-xs uppercase tracking-widest font-mono">
                        <Check size={13} /> Mark reviewed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
