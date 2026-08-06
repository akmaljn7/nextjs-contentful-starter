import React, { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, BACKEND, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/MapView";
import { StatusChip } from "@/components/StatusChip";
import { fmtCoord, fmtDateTime, fmtMinutes, STATUS_LABEL } from "@/lib/format";
import { useLiveSessions } from "@/hooks/useLiveSessions";
import { toast } from "sonner";
import { Building2, Users, Activity, PauseCircle, Database, ShieldAlert, Wifi, Camera, Bell, X } from "lucide-react";

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
  // Open the live WebSocket — pushes into the ["live"] cache in real time.
  useLiveSessions(true);
  const qc = useQueryClient();

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
  });

  const { data: live = [] } = useQuery({
    queryKey: ["live"],
    queryFn: async () => (await api.get("/sessions/live")).data,
    refetchInterval: 8000, // slower polling as safety-net; WS is primary
  });

  const challengeNow = useMutation({
    mutationFn: async (userId) => (await api.post(`/sessions/challenge-now/${userId}`)).data,
    onSuccess: () => { toast.success("Selfie challenge sent"); qc.invalidateQueries({ queryKey: ["live"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const forceExpire = useMutation({
    mutationFn: async (userId) => (await api.post(`/sessions/force-expire/${userId}`)).data,
    onSuccess: () => { toast.success("Session ended"); qc.invalidateQueries({ queryKey: ["live"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const nudge = useMutation({
    mutationFn: async (userId) =>
      (await api.post(`/sessions/nudge/${userId}`, {
        title: "Check-in reminder",
        body: "Please open Attendance Console and start your shift.",
      })).data,
    onSuccess: (data) => toast.success(`Reminder sent to ${data.sent_to || "employee"}`),
    onError: (e) => toast.error(toApiError(e)),
  });

  // Roster used for the "Ping any employee" panel — always visible even when
  // nobody has an active session yet.
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });

  const { data: summary = {} } = useQuery({
    queryKey: ["summary"],
    queryFn: async () => (await api.get("/attendance/summary")).data,
    refetchInterval: 15000,
  });

  const pins = useMemo(() => live.map((s) => ({
    id: s.id, lat: s.last_fix?.lat, lng: s.last_fix?.lng,
    status: s.status, label: s.employee_name, has_photo: s.has_photo,
  })).filter((p) => p.lat != null && p.lng != null), [live]);

  // Focus the fit only on the current subject: live pins if any exist,
  // otherwise the offices. This prevents the map from zooming out to the
  // whole globe when offices are on different continents.
  const focusPoints = useMemo(() => {
    if (pins.length > 0) return pins.map((p) => ({ ...p, zoom: 17 }));
    if (offices.length > 0) return offices.map((o) => ({ lat: o.lat, lng: o.lng, zoom: 15 }));
    return null;
  }, [pins, offices]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="label-uppercase">CONSOLE</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Operations overview</h1>
        </div>
        <div className="mono text-[10px] uppercase tracking-widest text-gray-500 inline-flex items-center gap-1.5" data-testid="ws-indicator">
          <Wifi size={12} className="text-green-400" /> LIVE · WEBSOCKET
        </div>
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
              <div className="text-sm text-gray-400 mt-0.5">
                {pins.length > 0 ? `Tracking ${pins.length} employee${pins.length === 1 ? "" : "s"} in real time` : "Real-time employee positions"}
              </div>
            </div>
            <div className="mono text-[10px] uppercase tracking-widest text-gray-500">
              {pins.length > 0 ? "FOCUSED · LIVE" : offices.length > 0 ? "FIT · OFFICES" : "STANDBY"}
            </div>
          </div>
          <div className="p-2">
            <MapView
              height={480}
              offices={offices}
              pins={pins}
              focusPoints={focusPoints}
            />
          </div>
        </div>

        <div className="surface" data-testid="live-list">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="label-uppercase">LIVE SESSIONS</div>
            <div className="text-sm text-gray-400 mt-0.5">{live.length} in progress</div>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {live.length === 0 && (
              <div className="p-6">
                <div className="text-center text-gray-500 text-xs mono mb-4" data-testid="no-active-sessions">
                  NO ACTIVE SESSIONS
                </div>
                <div className="label-uppercase mb-2">PING ANY EMPLOYEE</div>
                <div className="text-xs text-gray-500 mb-3">
                  Send a push reminder to any employee to open the app and start their shift.
                </div>
                <div className="space-y-2">
                  {employees.length === 0 && (
                    <div className="text-xs text-gray-500 mono">NO EMPLOYEES YET</div>
                  )}
                  {employees.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 border border-white/5 px-3 py-2" data-testid={`roster-row-${e.id}`}>
                      <div className="min-w-0">
                        <div className="text-sm truncate">{e.name}</div>
                        <div className="text-[10px] text-gray-500 mono truncate">{e.email}</div>
                      </div>
                      <button
                        onClick={() => nudge.mutate(e.id)}
                        disabled={nudge.isPending}
                        data-testid={`roster-nudge-${e.id}`}
                        title="Send a push notification"
                        className="border border-amber-500/30 hover:bg-amber-500/10 text-amber-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1 disabled:opacity-40 flex-none"
                      >
                        <Bell size={12} /> Notify
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {live.map((s, i) => (
              <div key={s.id} className="p-4 border-b border-white/5 stagger" style={{ animationDelay: `${i * 40}ms` }} data-testid={`live-row-${s.id}`}>
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {s.has_photo ? (
                      <img
                        src={`${BACKEND}/api/photos/session/${s.id}`}
                        alt=""
                        className="w-10 h-10 rounded-sm object-cover border border-white/10 flex-none"
                        data-testid={`live-photo-${s.id}`}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-sm flex-none grid place-items-center bg-[#262626] mono text-xs text-white" data-testid={`live-initials-${s.id}`}>
                        {(s.employee_name || "??").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.employee_name}</div>
                      <div className="text-xs text-gray-500 mono truncate">{s.employee_email}</div>
                    </div>
                  </div>
                  <StatusChip status={s.status} label={STATUS_LABEL[s.status]} testId={`chip-${s.id}`} />
                </div>
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
                {s.stale && (
                  <div className="mt-2 text-[10px] mono uppercase tracking-widest text-amber-400 border border-amber-500/30 bg-amber-500/10 inline-block px-2 py-0.5 ml-1" data-testid={`live-stale-${s.id}`}>STALE · NO PINGS</div>
                )}
                {s.active_challenge && (
                  <div className="mt-2 text-[10px] mono uppercase tracking-widest text-blue-400 border border-blue-500/30 bg-blue-500/10 inline-block px-2 py-0.5" data-testid={`live-pending-challenge-${s.id}`}>PENDING SELFIE</div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => challengeNow.mutate(s.user_id)}
                    disabled={challengeNow.isPending || !!s.active_challenge}
                    data-testid={`send-selfie-${s.id}`}
                    className="border border-blue-500/30 hover:bg-blue-500/10 text-blue-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={s.active_challenge ? "There's already a pending selfie challenge for this employee" : "Send a selfie challenge now"}
                  >
                    <Camera size={12} /> Send selfie now
                  </button>
                  <button
                    onClick={() => { if (confirm(`End ${s.employee_name}'s session?`)) forceExpire.mutate(s.user_id); }}
                    data-testid={`force-expire-${s.id}`}
                    className="border border-red-500/30 hover:bg-red-500/10 text-red-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1"
                    title="Force-end this session"
                  >
                    <X size={12} /> End session
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-gray-600 mono">started {fmtDateTime(s.start_time)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
