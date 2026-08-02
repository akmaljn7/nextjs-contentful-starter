import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, BACKEND } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusChip } from "@/components/StatusChip";
import { fmtDateTime, fmtMinutes, STATUS_LABEL } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Download } from "lucide-react";

export default function AttendanceHistory() {
  const { user } = useAuth();
  const isAdmin = user.role !== "employee";
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (start) p.set("start", new Date(start).toISOString());
    if (end) p.set("end", new Date(end).toISOString());
    if (officeId) p.set("office_id", officeId);
    if (employeeId) p.set("user_id", employeeId);
    return p.toString();
  }, [start, end, officeId, employeeId]);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-records", params],
    queryFn: async () => (await api.get(`/attendance/records${params ? `?${params}` : ""}`)).data,
  });

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
    enabled: isAdmin,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
    enabled: isAdmin,
  });

  const csvUrl = `${BACKEND}/api/attendance/export.csv${params ? `?${params}` : ""}`;
  const pdfUrl = `${BACKEND}/api/attendance/export.pdf${params ? `?${params}` : ""}`;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">ATTENDANCE</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Immutable history</h1>
          <div className="text-xs text-gray-500 mono mt-1">HASH-CHAINED · TAMPER-EVIDENT</div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <a href={csvUrl} className="border border-white/10 hover:border-white/30 px-3 py-2 text-xs mono uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors" data-testid="export-csv"><Download size={12} /> CSV</a>
            <a href={pdfUrl} className="border border-white/10 hover:border-white/30 px-3 py-2 text-xs mono uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors" data-testid="export-pdf"><Download size={12} /> PDF</a>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="surface p-4 mb-6" data-testid="filters">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label-uppercase block mb-1.5">START</label>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} data-testid="filter-start" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-xs mono" />
            </div>
            <div>
              <label className="label-uppercase block mb-1.5">END</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="filter-end" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-xs mono" />
            </div>
            <div>
              <label className="label-uppercase block mb-1.5">OFFICE</label>
              <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} data-testid="filter-office" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-xs mono">
                <option value="">All</option>
                {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-uppercase block mb-1.5">EMPLOYEE</label>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} data-testid="filter-employee" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-xs mono">
                <option value="">All</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="surface" data-testid="records-table">
        {isLoading && <div className="p-6 text-gray-500 mono text-xs uppercase tracking-widest">LOADING…</div>}
        {!isLoading && records.length === 0 && <div className="p-8 text-center text-gray-500 text-sm">No records yet.</div>}
        {records.length > 0 && (
          <table className="w-full data-table">
            <thead><tr>
              {isAdmin && <th>EMPLOYEE</th>}
              <th>OFFICE</th><th>STARTED</th><th>ENDED</th><th>OUTCOME</th><th>INSIDE</th><th>BOUTS</th><th>HASH</th>
            </tr></thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id} className="stagger" style={{ animationDelay: `${i * 20}ms` }} data-testid={`record-${r.id}`}>
                  {isAdmin && <td className="font-medium">{r.employee_name}</td>}
                  <td className="text-gray-300">{r.office_name}</td>
                  <td className="mono text-gray-400 text-[11px]">{fmtDateTime(r.started_at)}</td>
                  <td className="mono text-gray-400 text-[11px]">{fmtDateTime(r.ended_at)}</td>
                  <td><StatusChip status={r.outcome} label={STATUS_LABEL[r.outcome] || r.outcome} /></td>
                  <td className="mono">{fmtMinutes(r.total_inside_ms)}</td>
                  <td className="mono">{r.bout_count}</td>
                  <td className="mono text-gray-500 text-[10px]" title={r.record_hash}>{r.record_hash?.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
