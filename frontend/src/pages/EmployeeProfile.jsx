import React, { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { todayShiftInfo, weeklyRows } from "@/lib/schedule";
import { CameraCapture } from "@/components/CameraCapture";
import { toast } from "sonner";
import { CalendarDays, Ban, Clock, ScanFace, Check, RefreshCw } from "lucide-react";

export default function EmployeeProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [camOpen, setCamOpen] = useState(false);

  const { data: offices = [] } = useQuery({ queryKey: ["offices"], queryFn: async () => (await api.get("/offices")).data });
  const office = offices.find((o) => o.id === user?.office_id);

  const { data: faceStatus } = useQuery({
    queryKey: ["face-status"],
    queryFn: async () => (await api.get("/face/status")).data,
  });

  const enroll = useMutation({
    mutationFn: async (dataUrl) => (await api.post("/face/enroll", { face_photo: dataUrl })).data,
    onSuccess: () => { toast.success("Face enrolled — future selfie challenges will now verify identity"); qc.invalidateQueries({ queryKey: ["face-status"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const schedule = user?.schedule || { mode: "any" };
  const mode = schedule.mode || "any";
  const rows = weeklyRows(schedule);
  const today = todayShiftInfo(schedule);
  const todayKey = today.state !== undefined ? (
    ["mon","tue","wed","thu","fri","sat","sun"][new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
  ) : null;

  return (
    <AppShell>
      <CameraCapture
        open={camOpen}
        onCancel={() => setCamOpen(false)}
        onCapture={(dataUrl) => { setCamOpen(false); enroll.mutate(dataUrl); }}
        subtitle="Enroll your face — one clear front-facing selfie"
      />

      <div className="mb-6">
        <div className="label-uppercase">PROFILE</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">{user?.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <div className="surface p-5" data-testid="profile-info">
          <div className="label-uppercase mb-3">IDENTITY</div>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">NAME</dt><dd className="mt-0.5">{user?.name}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">EMAIL</dt><dd className="mt-0.5 mono">{user?.email}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">ROLE</dt><dd className="mt-0.5 mono uppercase tracking-widest text-xs">{user?.role}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">MEMBER SINCE</dt><dd className="mt-0.5 mono text-xs">{fmtDateTime(user?.created_at)}</dd></div>
          </dl>
        </div>

        <div className="surface p-5" data-testid="profile-org">
          <div className="label-uppercase mb-3">ASSIGNMENT</div>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">ORG</dt><dd className="mt-0.5">{user?.org_name}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">OFFICE</dt><dd className="mt-0.5">{office ? office.name : "— unassigned —"}</dd></div>
            {office && (
              <>
                <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">COORDINATES</dt><dd className="mt-0.5 mono text-xs">{office.lat.toFixed(6)}, {office.lng.toFixed(6)}</dd></div>
                <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">RADIUS</dt><dd className="mt-0.5 mono">{office.radius_meters} m</dd></div>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Face enrollment */}
      <div className="mt-6 max-w-3xl">
        <div className="surface" data-testid="profile-face">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanFace size={14} className="text-gray-400" />
              <div className="label-uppercase">FACE ENROLLMENT</div>
            </div>
            <div className={`mono text-[10px] uppercase tracking-widest ${faceStatus?.enrolled ? "text-green-400" : "text-amber-400"}`} data-testid="face-status">
              {faceStatus?.enrolled ? "ENROLLED" : "NOT ENROLLED"}
            </div>
          </div>
          <div className="p-5">
            <div className="text-sm text-gray-400 mb-4">
              {faceStatus?.enrolled
                ? `Your face was enrolled on ${fmtDateTime(faceStatus.enrolled_at)}. Every selfie challenge is verified against this baseline. If your appearance changes significantly, you can re-enroll.`
                : "Enroll a clear front-facing selfie so future random check-ins can verify it's really you. Without enrollment, admins can't confirm the person responding to a challenge is you."}
            </div>
            <button
              onClick={() => setCamOpen(true)}
              disabled={enroll.isPending}
              data-testid="enroll-face-btn"
              className={`px-4 py-2 text-sm inline-flex items-center gap-2 transition-colors ${
                faceStatus?.enrolled
                  ? "border border-white/10 hover:border-white/30"
                  : "bg-green-500 text-black hover:bg-green-400 font-medium"
              }`}
            >
              {faceStatus?.enrolled ? <><RefreshCw size={14} /> Re-enroll face</> : <><Check size={14} /> Enroll my face</>}
            </button>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="mt-6 max-w-3xl">
        <div className="surface" data-testid="profile-schedule">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-gray-400" />
              <div className="label-uppercase">MY SCHEDULE</div>
            </div>
            <div className="mono text-[10px] uppercase tracking-widest text-gray-500">
              {mode === "any" ? "ANY TIME" : mode === "fixed_hours" ? `MIN ${schedule.min_hours_per_day || 6}h/day` : (schedule.timezone || "UTC")}
            </div>
          </div>
          <div className="p-5">
            {mode === "any" && (
              <div className="text-sm text-gray-400">No fixed schedule — you may start a session any time inside your office geofence.</div>
            )}
            {mode === "fixed_hours" && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 border border-green-500/40 bg-green-500/10 grid place-items-center">
                  <Clock size={18} className="text-green-400" />
                </div>
                <div>
                  <div className="mono text-2xl">{schedule.min_hours_per_day || 6}<span className="text-sm text-gray-500 ml-1">h/day</span></div>
                  <div className="text-xs text-gray-500 mono uppercase tracking-widest mt-1">Minimum inside-time target</div>
                </div>
              </div>
            )}
            {mode === "weekly_calendar" && (
              <div className="space-y-1">
                {today.headline && (
                  <div className="mb-3 border border-white/10 bg-white/[0.03] p-3">
                    <div className="mono text-[10px] uppercase tracking-widest text-gray-500">TODAY</div>
                    <div className="mono text-sm mt-1">{today.headline}</div>
                    <div className={`mono text-[10px] uppercase tracking-widest mt-0.5 ${today.state === "open" ? "text-green-400" : (today.state === "after" || today.state === "off") ? "text-red-400" : "text-gray-500"}`}>{today.subline}</div>
                  </div>
                )}
                <div className="divide-y divide-white/5">
                  {rows.map(({ key, label, day }) => {
                    const isToday = key === todayKey;
                    return (
                      <div key={key} className={`grid grid-cols-[80px_1fr_auto] gap-3 items-center py-2 ${isToday ? "text-white" : ""}`}>
                        <div className={`mono text-xs uppercase tracking-widest ${isToday ? "text-green-400" : "text-gray-400"}`}>{label}{isToday ? " ·" : ""}</div>
                        <div className="mono text-sm">
                          {day ? `${day.open} → ${day.close}` : <span className="text-gray-600 inline-flex items-center gap-1"><Ban size={11} /> OFF</span>}
                        </div>
                        <div className="mono text-[10px] uppercase tracking-widest text-gray-600">
                          {day ? `${(((parseInt(day.close.slice(0,2))*60+parseInt(day.close.slice(3))) - (parseInt(day.open.slice(0,2))*60+parseInt(day.open.slice(3))))/60).toFixed(1)}h` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
