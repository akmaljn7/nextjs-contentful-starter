import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError, BACKEND } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { AlertTriangle, Check, X, Image as ImageIcon, BatteryLow, ShieldCheck, ShieldX } from "lucide-react";

const STATUSES = ["pending", "approved", "rejected", "all"];

function fmtGap(ms) {
  const mins = Math.round((ms || 0) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function fmtDT(ms) {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
}
function pct(f) { return f == null ? "unknown" : `${Math.round(f * 100)}%`; }

function GapPhoto({ gapId, kind = "photo", label = "View selfie", alt = "reason selfie" }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/gaps/${gapId}/${kind}`, { responseType: "blob" });
      setUrl(URL.createObjectURL(res.data));
    } catch (e) {
      toast.error(toApiError(e));
    } finally { setLoading(false); }
  };
  if (url) return <img src={url} alt={alt} className="mt-2 max-h-48 border border-white/10" data-testid={`gap-${kind}-img-${gapId}`} />;
  return (
    <button onClick={load} disabled={loading} data-testid={`gap-${kind}-btn-${gapId}`}
      className="mt-2 mr-2 inline-flex items-center gap-1.5 text-xs border border-white/10 hover:border-white/30 px-2 py-1 mono text-gray-300">
      <ImageIcon size={13} /> {loading ? "Loading…" : label}
    </button>
  );
}

export default function GapReviews() {
  const [status, setStatus] = useState("pending");
  const qc = useQueryClient();
  const { data: gaps = [], isLoading } = useQuery({
    queryKey: ["gaps", status],
    queryFn: () => api.get(`/gaps?status=${status}`).then((r) => r.data),
    refetchInterval: 15000,
  });

  const decide = useMutation({
    mutationFn: ({ id, action }) => api.post(`/gaps/${id}/${action}`).then((r) => r.data),
    onSuccess: (_d, v) => {
      toast.success(v.action === "approve" ? "Gap approved — time credited" : "Gap rejected — marked absent");
      qc.invalidateQueries({ queryKey: ["gaps"] });
    },
    onError: (e) => toast.error(toApiError(e)),
  });

  return (
    <AppShell>
      <div className="space-y-6" data-testid="gap-reviews-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="label-uppercase text-gray-500">Attendance Integrity</div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-400" /> Coverage Gap Reviews
            </h1>
            <p className="text-sm text-gray-500 mt-1">Time where a device went dark (phone off / app killed). Approve to count it, reject to mark absent.</p>
          </div>
          <div className="flex gap-1">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatus(s)} data-testid={`gap-filter-${s}`}
                className={`px-3 py-1.5 text-xs uppercase tracking-widest font-mono border ${status === s ? "border-green-500 text-white" : "border-white/10 text-gray-400 hover:text-white"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="label-uppercase text-gray-500">Loading…</div>
        ) : gaps.length === 0 ? (
          <div className="surface p-10 text-center text-gray-500" data-testid="gap-empty">
            <Check size={28} className="mx-auto mb-3 text-green-500" />
            No {status !== "all" ? status : ""} coverage gaps. Everyone's tracking is intact.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {gaps.map((g) => (
              <div key={g.id} className="surface p-4 space-y-3" data-testid={`gap-card-${g.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{g.employee_name}</div>
                    <div className="text-xs text-gray-500 mono">{g.employee_email}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest mono px-2 py-1 border ${
                    g.status === "pending" ? "border-amber-500/40 text-amber-400"
                    : g.status === "approved" ? "border-green-500/40 text-green-400"
                    : "border-red-500/40 text-red-400"}`} data-testid={`gap-status-${g.id}`}>
                    {g.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle size={15} className="text-red-400" />
                  <span className="mono text-red-300">GAP {fmtGap(g.gap_ms)}</span>
                  <span className="text-gray-500 text-xs">{fmtDT(g.from_ms)} → {fmtDT(g.to_ms)}</span>
                </div>

                <div className="flex items-center gap-3 text-xs mono">
                  {g.likely_battery_died ? (
                    <span className="inline-flex items-center gap-1 text-gray-400"><BatteryLow size={13} /> battery {pct(g.battery_before)} · likely died</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-400"><BatteryLow size={13} /> battery {pct(g.battery_before)} · suspicious</span>
                  )}
                </div>

                {g.reason_note ? (
                  <div className="border-l-2 border-white/10 pl-3 text-sm">
                    <div className="text-gray-300">"{g.reason_note}"</div>
                    <div className="text-[10px] text-gray-500 mono mt-1">
                      by {g.reason_by}
                      {g.selfie_match === true && <span className="text-green-400 ml-2 inline-flex items-center gap-1"><ShieldCheck size={11} /> selfie verified {g.selfie_similarity != null && `(${g.selfie_similarity.toFixed(2)})`}</span>}
                      {g.selfie_match === false && <span className="text-red-400 ml-2 inline-flex items-center gap-1"><ShieldX size={11} /> selfie did NOT match</span>}
                    </div>
                    {g.has_photo && <GapPhoto gapId={g.id} kind="photo" label="View selfie" alt="reason selfie" />}
                    {g.has_evidence_photo && <GapPhoto gapId={g.id} kind="evidence" label="View phone photo" alt="phone evidence" />}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 italic">No reason submitted yet.</div>
                )}

                {g.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => decide.mutate({ id: g.id, action: "approve" })} disabled={decide.isPending}
                      data-testid={`gap-approve-${g.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 border border-green-500/40 text-green-400 hover:bg-green-500/10 px-3 py-2 text-xs uppercase tracking-widest font-mono">
                      <Check size={14} /> Approve (count time)
                    </button>
                    <button onClick={() => decide.mutate({ id: g.id, action: "reject" })} disabled={decide.isPending}
                      data-testid={`gap-reject-${g.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 border border-red-500/40 text-red-400 hover:bg-red-500/10 px-3 py-2 text-xs uppercase tracking-widest font-mono">
                      <X size={14} /> Reject (absent)
                    </button>
                  </div>
                )}
                {g.reviewed_by && (
                  <div className="text-[10px] text-gray-500 mono">Reviewed by {g.reviewed_by}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
