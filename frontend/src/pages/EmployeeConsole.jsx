import React, { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/MapView";
import { StatusChip } from "@/components/StatusChip";
import { CountdownTimer } from "@/components/CountdownTimer";
import { useAuth } from "@/context/AuthContext";
import { fmtCoord, fmtDateTime, fmtDist, fmtMinutes, STATUS_LABEL } from "@/lib/format";
import { toast } from "sonner";
import { Play, RotateCcw, Radar } from "lucide-react";

function useGeolocation() {
  const [fix, setFix] = useState(null);
  const [err, setErr] = useState("");
  const watchId = useRef(null);
  const start = () => {
    if (!("geolocation" in navigator)) { setErr("Geolocation not supported"); return; }
    setErr("");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, ts: Date.now() }),
      (e) => setErr(e.message || "Location denied"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };
  const stop = () => { if (watchId.current != null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; } };
  useEffect(() => () => stop(), []);
  return { fix, err, start, stop };
}

export default function EmployeeConsole() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const geo = useGeolocation();
  const [pingActive, setPingActive] = useState(false);
  const pingTimer = useRef(null);

  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
  });
  const office = offices.find((o) => o.id === user.office_id);

  const { data: session } = useQuery({
    queryKey: ["my-session"],
    queryFn: async () => (await api.get("/sessions/me")).data,
    refetchInterval: 4000,
  });

  useEffect(() => { geo.start(); return () => geo.stop(); }, []);

  const start = useMutation({
    mutationFn: async () => {
      if (!geo.fix) throw new Error("No GPS fix yet");
      return (await api.post("/sessions/start", { lat: geo.fix.lat, lng: geo.fix.lng, accuracy: geo.fix.accuracy })).data;
    },
    onSuccess: (data) => { toast.success("Session started"); qc.setQueryData(["my-session"], data); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const reset = useMutation({
    mutationFn: async () => (await api.post("/sessions/reset")).data,
    onSuccess: () => { toast.success("Session reset"); qc.setQueryData(["my-session"], null); },
    onError: (e) => toast.error(toApiError(e)),
  });

  // Auto-ping every 8s while session active or paused
  useEffect(() => {
    if (!session || !geo.fix) { setPingActive(false); if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; } return; }
    if (session.status !== "active" && session.status !== "paused") return;
    setPingActive(true);
    const sendPing = async () => {
      if (!geo.fix) return;
      try {
        const { data } = await api.post("/sessions/ping", { lat: geo.fix.lat, lng: geo.fix.lng, accuracy: geo.fix.accuracy });
        if (data?.ended) { qc.setQueryData(["my-session"], null); toast(data.outcome === "completed" ? "Session completed" : `Session ${data.outcome}`); return; }
        qc.setQueryData(["my-session"], data);
      } catch (e) { /* ping errors are non-fatal */ }
    };
    sendPing();
    pingTimer.current = setInterval(sendPing, 8000);
    return () => { if (pingTimer.current) clearInterval(pingTimer.current); };
  }, [session?.status, geo.fix?.lat, geo.fix?.lng]);

  const canStart = geo.fix && office && !session;

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="surface" data-testid="employee-map">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="label-uppercase">FIELD VIEW</div>
              <div className="text-sm text-gray-400 mt-0.5">{office?.name || "No office assigned"}</div>
            </div>
            <div className="mono text-[10px] uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Radar size={12} className={geo.fix ? "text-green-400" : "text-red-400"} />
              {geo.fix ? "GPS LOCK" : "SEARCHING…"}
            </div>
          </div>
          <div className="p-2">
            <MapView
              height={480}
              offices={office ? [office] : []}
              geofence={session ? { lat: session.center.lat, lng: session.center.lng, radius_m: session.center.radius_m, color: "#f59e0b" } : null}
              pins={geo.fix ? [{ lat: geo.fix.lat, lng: geo.fix.lng, status: session?.status || "active", label: "You" }] : []}
              center={geo.fix || (office ? { lat: office.lat, lng: office.lng } : null)}
              zoom={17}
            />
          </div>
        </div>

        <div className="space-y-4">
          {/* Session card */}
          <div className="surface p-5" data-testid="session-card">
            <div className="flex items-center justify-between mb-3">
              <div className="label-uppercase">SESSION</div>
              {session ? <StatusChip status={session.status} label={STATUS_LABEL[session.status]} testId="session-status-chip" /> : <StatusChip status="reset" label="IDLE" />}
            </div>
            <CountdownTimer
              remainingMs={session?.remaining_ms ?? 60 * 60 * 1000}
              active={session?.status === "active"}
              testId="countdown"
            />
            <div className="mt-2 text-xs text-gray-500 mono">
              {session ? `bout ${session.bout_count} · inside ${fmtMinutes(session.total_inside_ms)}` : "Ready to sign in"}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {!session && (
                <button
                  onClick={() => start.mutate()}
                  disabled={!canStart || start.isPending}
                  data-testid="start-session-btn"
                  className="col-span-2 bg-green-500 text-black hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed font-medium py-3 text-sm inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Play size={14} /> {start.isPending ? "Starting…" : "Register location & start"}
                </button>
              )}
              {session && (
                <button
                  onClick={() => { if (confirm("Reset your session? This will end the current run.")) reset.mutate(); }}
                  data-testid="reset-session-btn"
                  className="col-span-2 border border-red-500/30 hover:bg-red-500/10 text-red-400 font-medium py-3 text-sm inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw size={14} /> Reset session
                </button>
              )}
            </div>

            {geo.err && (
              <div className="mt-3 border border-red-500/30 bg-red-500/10 p-2 text-xs mono text-red-400" data-testid="gps-error">
                GPS ERROR: {geo.err}
              </div>
            )}
          </div>

          {/* Location card */}
          <div className="surface p-4" data-testid="location-card">
            <div className="label-uppercase mb-3">TELEMETRY</div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-gray-500 mono uppercase tracking-widest text-[10px]">LATITUDE</dt>
                <dd className="mono text-sm mt-1">{fmtCoord(geo.fix?.lat)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mono uppercase tracking-widest text-[10px]">LONGITUDE</dt>
                <dd className="mono text-sm mt-1">{fmtCoord(geo.fix?.lng)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mono uppercase tracking-widest text-[10px]">ACCURACY</dt>
                <dd className="mono text-sm mt-1">{fmtDist(geo.fix?.accuracy)}</dd>
              </div>
              <div>
                <dt className="text-gray-500 mono uppercase tracking-widest text-[10px]">RADIUS</dt>
                <dd className="mono text-sm mt-1">{office ? `${office.radius_meters} m` : "—"}</dd>
              </div>
            </dl>
          </div>

          {/* Event log */}
          <div className="surface" data-testid="event-log">
            <div className="px-4 py-3 border-b border-white/10 label-uppercase">EVENT LOG</div>
            <div className="max-h-[240px] overflow-y-auto">
              {(!session || !session.log || session.log.length === 0) && (
                <div className="p-4 text-xs text-gray-500 mono">NO EVENTS</div>
              )}
              {session?.log?.slice().reverse().map((ev, i) => (
                <div key={i} className="px-4 py-2 border-b border-white/5 text-xs mono flex items-center justify-between">
                  <span className="text-gray-300 uppercase tracking-widest">{ev.event}</span>
                  <span className="text-gray-500">{fmtDateTime(new Date(ev.ts_ms).toISOString())}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
