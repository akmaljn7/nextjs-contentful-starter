import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, BACKEND } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { Download } from "lucide-react";

function bucketByDay(records) {
  const map = new Map();
  records.forEach((r) => {
    const day = (r.ended_at || "").slice(0, 10);
    if (!day) return;
    const entry = map.get(day) || { day, count: 0, minutes: 0, flagged: 0 };
    entry.count += 1;
    entry.minutes += (r.total_inside_ms || 0) / 60000;
    if (r.flagged) entry.flagged += 1;
    map.set(day, entry);
  });
  return Array.from(map.values()).sort((a, b) => (a.day < b.day ? -1 : 1));
}

function bucketByEmployee(records) {
  const map = new Map();
  records.forEach((r) => {
    const key = r.user_id;
    const entry = map.get(key) || { user_id: key, name: r.employee_name, count: 0, minutes: 0 };
    entry.count += 1;
    entry.minutes += (r.total_inside_ms || 0) / 60000;
    map.set(key, entry);
  });
  return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
}

export default function Reports() {
  const { data: records = [] } = useQuery({
    queryKey: ["all-records"],
    queryFn: async () => (await api.get("/attendance/records?limit=1000")).data,
  });

  const daily = useMemo(() => bucketByDay(records), [records]);
  const byEmp = useMemo(() => bucketByEmployee(records), [records]);
  const maxDaily = Math.max(1, ...daily.map((d) => d.minutes));

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">REPORTS</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Analytics & exports</h1>
        </div>
        <div className="flex gap-2">
          <a href={`${BACKEND}/api/attendance/export.csv`} className="border border-white/10 hover:border-white/30 px-3 py-2 text-xs mono uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors" data-testid="reports-csv"><Download size={12} /> CSV</a>
          <a href={`${BACKEND}/api/attendance/export.pdf`} className="border border-white/10 hover:border-white/30 px-3 py-2 text-xs mono uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors" data-testid="reports-pdf"><Download size={12} /> PDF</a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface" data-testid="daily-report">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="label-uppercase">DAILY INSIDE-TIME</div>
            <div className="text-sm text-gray-400 mt-0.5">Aggregated minutes per day</div>
          </div>
          <div className="p-4">
            {daily.length === 0 && <div className="text-sm text-gray-500 py-6 text-center">No data yet.</div>}
            {daily.map((d, i) => (
              <div key={d.day} className="mb-2 stagger" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex justify-between text-xs mono mb-1">
                  <span className="text-gray-400">{d.day}</span>
                  <span>{d.minutes.toFixed(1)} min · {d.count} sess {d.flagged > 0 && <span className="text-red-400">· {d.flagged} flagged</span>}</span>
                </div>
                <div className="h-1.5 bg-white/5">
                  <div className="h-full bg-green-500" style={{ width: `${(d.minutes / maxDaily) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface" data-testid="employee-report">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="label-uppercase">TOP EMPLOYEES</div>
            <div className="text-sm text-gray-400 mt-0.5">By total inside-time</div>
          </div>
          <div className="p-4">
            {byEmp.length === 0 && <div className="text-sm text-gray-500 py-6 text-center">No data yet.</div>}
            {byEmp.slice(0, 10).map((e, i) => (
              <div key={e.user_id} className="flex items-center justify-between py-2 border-b border-white/5 stagger" style={{ animationDelay: `${i * 30}ms` }}>
                <div>
                  <div className="text-sm">{e.name}</div>
                  <div className="text-[11px] mono text-gray-500">{e.count} session{e.count === 1 ? "" : "s"}</div>
                </div>
                <div className="mono text-sm">{e.minutes.toFixed(1)} min</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
