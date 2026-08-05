import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/MapView";
import { StatusChip } from "@/components/StatusChip";
import { CountdownTimer } from "@/components/CountdownTimer";
import { CameraCapture } from "@/components/CameraCapture";
import { useAuth } from "@/context/AuthContext";
import { fmtCoord, fmtDateTime, fmtDist, fmtMinutes, STATUS_LABEL } from "@/lib/format";
import { computeIdleRemainingMs, todayShiftInfo } from "@/lib/schedule";
import { toast } from "sonner";
import { Play, RotateCcw, Radar, CalendarClock, CalendarOff } from "lucide-react";

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
  const pingTimer = useRef(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeInfo, setChallengeInfo] = useState(null); // {id, respond_by_ms}
  const autoStartRef = useRef(false);

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

  const { data: todayOff } = useQuery({
    queryKey: ["time-off-today"],
    queryFn: async () => (await api.get("/time-off/today")).data,
    refetchInterval: 30000,
  });

  // Auto-open the challenge modal whenever the server reports an active challenge
  useEffect(() => {
    if (session?.active_challenge && !challengeOpen && challengeInfo?.id !== session.active_challenge.id) {
      setChallengeInfo(session.active_challenge);
      setChallengeOpen(true);
      toast("Selfie check-in requested — respond within 5 minutes", { duration: 6000 });
    }
  }, [session?.active_challenge?.id]); // eslint-disable-line

  const autoStart = useMutation({
    mutationFn: async () => {
      if (!geo.fix) throw new Error("No GPS fix yet");
      return (await api.post("/sessions/auto-start", { lat: geo.fix.lat, lng: geo.fix.lng, accuracy: geo.fix.accuracy })).data;
    },
    onSuccess: (data) => {
      toast.success("You're in the office — attendance started automatically");
      qc.setQueryData(["my-session"], data);
    },
    onError: () => { autoStartRef.current = false; },
  });

  // Auto-start when GPS lock puts us inside the office radius and no session is running
  useEffect(() => {
    if (session || !geo.fix || !office || autoStartRef.current || autoStart.isPending) return;
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const p1 = toRad(geo.fix.lat), p2 = toRad(office.lat);
    const dp = toRad(office.lat - geo.fix.lat), dl = toRad(office.lng - geo.fix.lng);
    const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    const dist = 2 * R * Math.asin(Math.sqrt(a));
    if (dist <= office.radius_meters && (geo.fix.accuracy ?? 999) <= 50) {
      autoStartRef.current = true;
      autoStart.mutate();
    }
  }, [session, geo.fix?.lat, geo.fix?.lng, office?.id]); // eslint-disable-line

  useEffect(() => { geo.start(); return () => geo.stop(); }, []);

  const start = useMutation({
    mutationFn: async (facePhoto) => {
      if (!geo.fix) throw new Error("No GPS fix yet");
      const body = { lat: geo.fix.lat, lng: geo.fix.lng, accuracy: geo.fix.accuracy };
      if (facePhoto) body.face_photo = facePhoto;
      return (await api.post("/sessions/start", body)).data;
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
    if (!session || !geo.fix) { if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; } return; }
    if (session.status !== "active" && session.status !== "paused") return;
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

  // Compute the idle countdown & today's shift info from the employee's schedule
  const shiftInfo = useMemo(() => todayShiftInfo(user?.schedule), [user?.schedule]);
  // Recompute every 30s so the "starts at" / "ended at" state stays fresh
  const [idleTick, setIdleTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdleTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const idleRemaining = useMemo(() => computeIdleRemainingMs(user?.schedule, 60), [user?.schedule, idleTick]);
  const displayRemaining = session ? session.remaining_ms : idleRemaining;

  const onStartClick = () => {
    if (!canStart) return;
    setCaptureOpen(true);
  };

  const onCaptured = (dataUrl) => {
    setCaptureOpen(false);
    start.mutate(dataUrl);
  };

  return (
    <AppShell>
      <CameraCapture
        open={captureOpen}
        onCancel={() => setCaptureOpen(false)}
        onCapture={onCaptured}
        subtitle={office ? `${office.name} · ${office.radius_meters}m` : ""}
      />
      <CameraCapture
        open={challengeOpen}
        onCancel={() => { setChallengeOpen(false); /* backend expiry will flag if truly no response */ }}
        onCapture={async (dataUrl) => {
          const cid = challengeInfo?.id;
          setChallengeOpen(false);
          try {
            const { data } = await api.post(`/sessions/challenge/${cid}/respond`, { face_photo: dataUrl });
            qc.setQueryData(["my-session"], data);
            toast.success("Selfie check-in confirmed");
          } catch (e) {
            toast.error(toApiError(e));
          }
        }}
        subtitle={`Random check-in · respond within 5 min`}
      />
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
              pins={geo.fix ? [{ id: "me", lat: geo.fix.lat, lng: geo.fix.lng, status: session?.status || "active", label: user?.name || "You" }] : []}
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
              remainingMs={displayRemaining}
              active={session?.status === "active"}
              testId="countdown"
            />
            <div className="mt-2 text-xs text-gray-500 mono">
              {session ? `bout ${session.bout_count} · inside ${fmtMinutes(session.total_inside_ms)}` : "Ready to sign in"}
            </div>

            {/* Approved time-off banner overrides shift info */}
            {!session && todayOff && (
              <div
                className="mt-3 border border-blue-500/40 bg-blue-500/10 px-3 py-2 flex items-start gap-2"
                data-testid="time-off-today"
              >
                <CalendarOff size={14} className="text-blue-400 mt-0.5 flex-none" />
                <div className="min-w-0">
                  <div className="mono text-xs text-blue-300 truncate">Approved time off today</div>
                  <div className="mono text-[10px] uppercase tracking-widest text-blue-400 mt-0.5 truncate">
                    {todayOff.reason || "no reason"} · until {todayOff.end_date}
                  </div>
                </div>
              </div>
            )}

            {/* Shift info under the countdown (visible when not in a session and no approved time-off) */}
            {!session && !todayOff && shiftInfo.headline && (
              <div
                className="mt-3 border border-white/10 bg-white/[0.03] px-3 py-2 flex items-start gap-2"
                data-testid="shift-info"
              >
                <CalendarClock size={14} className="text-gray-400 mt-0.5 flex-none" />
                <div className="min-w-0">
                  <div className="mono text-xs text-white truncate" data-testid="shift-headline">{shiftInfo.headline}</div>
                  {shiftInfo.subline && (
                    <div className={`mono text-[10px] uppercase tracking-widest mt-0.5 ${
                      shiftInfo.state === "open" ? "text-green-400" :
                      shiftInfo.state === "after" || shiftInfo.state === "off" ? "text-red-400" :
                      "text-gray-500"
                    }`} data-testid="shift-subline">{shiftInfo.subline}</div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              {!session && (
                <button
                  onClick={onStartClick}
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
