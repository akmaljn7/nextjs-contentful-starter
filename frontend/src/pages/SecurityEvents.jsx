import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusChip } from "@/components/StatusChip";
import { fmtDateTime } from "@/lib/format";

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
                  <td className="mono text-[11px] text-gray-400">{fmtDateTime(r.ts)}</td>
                  <td className="mono text-xs">{r.type}</td>
                  <td><StatusChip status={r.severity} label={r.severity.toUpperCase()} /></td>
                  <td className="text-xs">{r.user_name || <span className="text-gray-500">—</span>}</td>
                  <td className="mono text-[11px] text-gray-500">{r.ip || "—"}</td>
                  <td className="mono text-[10px] text-gray-400 max-w-[380px] truncate" title={JSON.stringify(r.details)}>{JSON.stringify(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
