import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/MapView";
import { StatusChip } from "@/components/StatusChip";
import { fmtCoord, fmtDateTime, fmtMinutes, STATUS_LABEL } from "@/lib/format";
import { Building2, Users, Activity, PauseCircle, Database, ShieldAlert } from "lucide-react";

const Stat = ({ label, value, sub, icon: Icon, testId }) => (
  <div className="surface p-4" data-testid={testId}>
    <div className="flex items-center justify-between mb-3">
      <div className="label-uppercase">{label}</div>
      {Icon && <Icon size={14} strokeWidth={1.5} className="text-gray-500" />}
    </div>
    <div className="mono text-3xl tabular-nums">{value}</div>
    {sub && <div className="mt-1 text-xs text-gray-500 mono">{sub}</div>}
  </div>
);

export default function AdminDashboard() {
  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
  });

  const { data: live = [] } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await api.get("/sessions/live")).data,
    refetchInterval: 3000,
  });

  const { data: summary = {} } = useQuery({
    queryKey: ["summary"],
    queryFn: async () => (await api.get("/attendance/summary")).data,
    refetchInterval: 10000,
  });

  const pins = useMemo(() => live.map((s) => ({
    id: s.id, lat: s.last_fix?.lat, lng: s.last_fix?.lng,
    status: s.status, label: s.employee_name,
  })).filter((p) => p.lat != null && p.lng != null), [live]);

  return (
    <AppShell>
      <div className="mb-6">
        <div className="label-uppercase">CONSOLE</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Operations overview</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Offices" value={summary.total_offices ?? "—"} icon={Building2} testId="stat-offices" />
        <Stat label="Employees" value={summary.total_employees ?? "—"} icon={Users} testId="stat-employees" />
        <Stat label="Active" value={summary.active_sessions ?? "—"} sub="live sessions" icon={Activity} testId="stat-active" />
        <Stat label="Paused" value={summary.paused_sessions ?? "—"} sub="outside geofence" icon={PauseCircle} testId="stat-paused" />
        <Stat label="Records" value={summary.total_records ?? "—"} sub="immutable log" icon={Database} testId="stat-records" />
        <Stat label="Flagged" value={summary.flagged_records ?? "—"} sub="anti-spoof triggers" icon={ShieldAlert} testId="stat-flagged" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface" data-testid="live-map">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="label-uppercase">LIVE MAP</div>
              <div className="text-sm text-gray-400 mt-0.5">Real-time employee positions</div>
            </div>
            <div className="mono text-[10px] uppercase tracking-widest text-gray-500">refresh · 3s</div>
          </div>
          <div className="p-2">
            <MapView height={480} offices={offices} pins={pins} fitAll={pins.length > 0 || offices.length > 0} />
          </div>
        </div>

        <div className="surface" data-testid="live-list">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="label-uppercase">LIVE SESSIONS</div>
            <div className="text-sm text-gray-400 mt-0.5">{live.length} in progress</div>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {live.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm mono">NO ACTIVE SESSIONS</div>
            )}
            {live.map((s, i) => (
              <div key={s.id} className="p-4 border-b border-white/5 stagger" style={{ animationDelay: `${i * 40}ms` }} data-testid={`live-row-${s.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{s.employee_name}</div>
                  <StatusChip status={s.status} label={STATUS_LABEL[s.status]} testId={`chip-${s.id}`} />
                </div>
                <div className="text-xs text-gray-500 mono">{s.employee_email}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs mono">
                  <div>
                    <div className="text-gray-500">REMAINING</div>
                    <div className="text-white mt-0.5">{Math.max(0, Math.round(s.remaining_ms / 1000))}s</div>
                  </div>
                  <div>
                    <div className="text-gray-500">BOUTS</div>
                    <div className="text-white mt-0.5">{s.bout_count}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">INSIDE</div>
                    <div className="text-white mt-0.5">{fmtMinutes(s.total_inside_ms)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">FIX</div>
                    <div className="text-white mt-0.5 truncate">
                      {fmtCoord(s.last_fix?.lat)}, {fmtCoord(s.last_fix?.lng)}
                    </div>
                  </div>
                </div>
                {s.flagged && (
                  <div className="mt-2 text-[10px] mono uppercase tracking-widest text-red-400 border border-red-500/30 bg-red-500/10 inline-block px-2 py-0.5">FLAGGED</div>
                )}
                <div className="mt-2 text-[10px] text-gray-600 mono">started {fmtDateTime(s.start_time)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
