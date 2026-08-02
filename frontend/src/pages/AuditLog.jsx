import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { fmtDateTime } from "@/lib/format";

export default function AuditLog() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => (await api.get("/audit-log")).data,
  });

  return (
    <AppShell>
      <div className="mb-6">
        <div className="label-uppercase">AUDIT</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Admin activity log</h1>
        <div className="text-xs text-gray-500 mono mt-1">7-YEAR RETENTION · IMMUTABLE</div>
      </div>

      <div className="surface" data-testid="audit-table">
        {isLoading && <div className="p-6 text-gray-500 mono text-xs uppercase tracking-widest">LOADING…</div>}
        {!isLoading && rows.length === 0 && <div className="p-8 text-center text-gray-500 text-sm">No admin actions recorded.</div>}
        {rows.length > 0 && (
          <table className="w-full data-table">
            <thead><tr>
              <th>TIMESTAMP</th><th>ACTOR</th><th>ACTION</th><th>TARGET</th><th>IP</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="stagger" style={{ animationDelay: `${i * 20}ms` }} data-testid={`audit-${r.id}`}>
                  <td className="mono text-[11px] text-gray-400">{fmtDateTime(r.ts)}</td>
                  <td>{r.actor_name || <span className="text-gray-500 mono text-[11px]">{r.actor_id?.slice(-6)}</span>}</td>
                  <td className="mono text-xs">{r.action}</td>
                  <td className="mono text-xs text-gray-400">{r.target_type} · {r.target_id?.slice(-8)}</td>
                  <td className="mono text-[11px] text-gray-500">{r.ip || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
