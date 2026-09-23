import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusChip } from "@/components/StatusChip";
import { fmtDateTime } from "@/lib/format";
import { AlertTriangle, ShieldCheck } from "lucide-react";

const PERM_LABEL = {
  always: "Always",
  when_in_use: "While Using",
  denied: "Never / Denied",
  restricted: "Restricted",
};

function EventDetails({ row }) {
  const d = row.details || {};
  const who = d.employee_name || row.user_name;

  if (row.type === "location_permission_downgraded" || row.type === "location_permission_restored") {
    const down = row.type === "location_permission_downgraded";
    const from = PERM_LABEL[d.from] || d.from || "—";
    const to = PERM_LABEL[d.to] || d.to || "—";
    return (
      <div className="flex flex-col gap-1" data-testid="perm-event-detail">
        <div className={`flex items-center gap-1.5 font-medium ${down ? "text-red-400" : "text-green-400"}`}>
          {down ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
          <span>{who ? <b>{who}</b> : "Employee"} {down ? "turned location OFF" : "restored location"}</span>
        </div>
        <div className="mono text-[11px] text-gray-400">
          {from} <span className="text-gray-600">→</span> {to}
          {d.employee_email ? <span className="text-gray-600"> · {d.employee_email}</span> : null}
        </div>
      </div>
    );
  }

  const entries = Object.entries(d).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return <span className="text-gray-600">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.slice(0, 6).map(([k, v]) => {
        const s = String(v);
        return (
          <span key={k} className="mono text-[10px] px-1.5 py-0.5 border border-white/10 bg-white/5 text-gray-300 rounded-sm">
            <span className="text-gray-500">{k}:</span> {s.length > 40 ? s.slice(0, 40) + "…" : s}
          </span>
        );
      })}
    </div>
  );
}

export default function SecurityEvents() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["security-events"],
    queryFn: async () => (await api.get("/security-events")).data,
    refetchInterval: 6000,
  });

  return (
    <AppShell>
      <div className="mb-6">
        <div className="label-uppercase">SECURITY</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Event stream</h1>
        <div className="text-xs text-gray-500 mono mt-1">FAILED LOGINS · SPOOF FLAGS · GEO DENIALS</div>
      </div>

      <div className="surface" data-testid="security-table">
        {isLoading && <div className="p-6 text-gray-500 mono text-xs uppercase tracking-widest">LOADING…</div>}
        {!isLoading && rows.length === 0 && <div className="p-8 text-center text-gray-500 text-sm">No security events recorded.</div>}
        {rows.length > 0 && (
          <table className="w-full data-table">
            <thead><tr>
              <th>TIMESTAMP</th><th>TYPE</th><th>SEVERITY</th><th>USER</th><th>IP</th><th>DETAILS</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="stagger" style={{ animationDelay: `${i * 20}ms` }} data-testid={`sec-${r.id}`}>
                  <td className="mono text-[11px] text-gray-400 align-top">{fmtDateTime(r.ts)}</td>
                  <td className="mono text-xs align-top">{r.type}</td>
                  <td className="align-top"><StatusChip status={r.severity} label={r.severity.toUpperCase()} /></td>
                  <td className="text-xs align-top">{r.user_name || <span className="text-gray-500">—</span>}</td>
                  <td className="mono text-[11px] text-gray-500 align-top">{r.ip || "—"}</td>
                  <td className="align-top max-w-[460px]"><EventDetails row={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
