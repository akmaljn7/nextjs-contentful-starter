import React from "react";
import { CalendarDays, Clock, Ban } from "lucide-react";

const DAYS = [
  ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"],
  ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
];

const TIMEZONES = [
  "UTC",
  "Africa/Lagos", "Africa/Cairo", "Africa/Nairobi", "Africa/Johannesburg",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Istanbul",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Sao_Paulo", "America/Toronto",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai",
  "Australia/Sydney",
];

const defaultDay = { open: "09:00", close: "17:00" };

function defaultWeek() {
  return {
    mon: { ...defaultDay }, tue: { ...defaultDay }, wed: { ...defaultDay },
    thu: { ...defaultDay }, fri: { ...defaultDay }, sat: null, sun: null,
  };
}

/**
 * Work-schedule editor.
 *
 * Props:
 *   value: { mode, min_hours_per_day, weekly_schedule, timezone }
 *   onChange(next): void
 */
export function ScheduleEditor({ value, onChange }) {
  const schedule = value || { mode: "any" };
  const mode = schedule.mode || "any";
  const weekly = schedule.weekly_schedule || defaultWeek();
  const tz = schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const setMode = (newMode) => {
    if (newMode === "any") { onChange({ mode: "any" }); return; }
    if (newMode === "fixed_hours") {
      onChange({ mode: "fixed_hours", min_hours_per_day: schedule.min_hours_per_day ?? 6 });
      return;
    }
    onChange({ mode: "weekly_calendar", timezone: tz, weekly_schedule: weekly });
  };

  const toggleDay = (key) => {
    const cur = weekly[key];
    const next = { ...weekly, [key]: cur ? null : { ...defaultDay } };
    onChange({ ...schedule, weekly_schedule: next });
  };

  const setDayField = (key, field, val) => {
    const day = weekly[key] || { ...defaultDay };
    const next = { ...weekly, [key]: { ...day, [field]: val } };
    onChange({ ...schedule, weekly_schedule: next });
  };

  return (
    <div className="space-y-3" data-testid="schedule-editor">
      <div>
        <label className="label-uppercase block mb-1.5">Work Schedule</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          data-testid="sched-mode"
          className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono"
        >
          <option value="any">Any time — no restriction (org default)</option>
          <option value="fixed_hours">Set hours — minimum hours per day</option>
          <option value="weekly_calendar">Use calendar — opening &amp; closing hours per weekday</option>
        </select>
      </div>

      {mode === "fixed_hours" && (
        <div className="border border-white/10 p-3 bg-white/[0.02]" data-testid="sched-fixed">
          <label className="label-uppercase block mb-1.5 flex items-center gap-1.5"><Clock size={12} /> Minimum hours per day</label>
          <input
            type="number"
            min={1}
            max={24}
            value={schedule.min_hours_per_day ?? 6}
            onChange={(e) => onChange({ ...schedule, min_hours_per_day: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })}
            data-testid="sched-min-hours"
            className="w-32 bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono"
          />
          <div className="text-[10px] text-gray-500 mono mt-2">Employee&apos;s session countdown will target this many hours inside the geofence per day.</div>
        </div>
      )}

      {mode === "weekly_calendar" && (
        <div className="border border-white/10 p-3 bg-white/[0.02]" data-testid="sched-weekly">
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarDays size={12} className="text-gray-400" />
            <label className="label-uppercase">Weekly Calendar</label>
          </div>
          <div className="mb-3">
            <label className="label-uppercase block mb-1.5">Timezone</label>
            <select
              value={tz}
              onChange={(e) => onChange({ ...schedule, timezone: e.target.value })}
              data-testid="sched-timezone"
              className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono"
            >
              {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            {DAYS.map(([k, label]) => {
              const day = weekly[k];
              const off = day == null;
              return (
                <div key={k} className="grid grid-cols-[54px_78px_1fr_1fr] gap-2 items-center" data-testid={`sched-row-${k}`}>
                  <div className="mono text-xs uppercase tracking-widest text-gray-400">{label}</div>
                  <button
                    type="button"
                    onClick={() => toggleDay(k)}
                    data-testid={`sched-toggle-${k}`}
                    className={`text-[10px] mono uppercase tracking-widest px-2 py-1 border transition-colors ${off ? "border-white/10 text-gray-500 hover:border-white/30" : "border-green-500/40 bg-green-500/10 text-green-400"}`}
                  >
                    {off ? <span className="inline-flex items-center gap-1"><Ban size={10} /> OFF</span> : "ON"}
                  </button>
                  <input
                    type="time"
                    value={day?.open || defaultDay.open}
                    disabled={off}
                    onChange={(e) => setDayField(k, "open", e.target.value)}
                    data-testid={`sched-open-${k}`}
                    className="bg-[#0a0a0a] border border-white/10 disabled:opacity-30 focus:border-white/30 focus:outline-none px-2 py-1.5 text-sm mono"
                  />
                  <input
                    type="time"
                    value={day?.close || defaultDay.close}
                    disabled={off}
                    onChange={(e) => setDayField(k, "close", e.target.value)}
                    data-testid={`sched-close-${k}`}
                    className="bg-[#0a0a0a] border border-white/10 disabled:opacity-30 focus:border-white/30 focus:outline-none px-2 py-1.5 text-sm mono"
                  />
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-gray-500 mono mt-3">Employee can only start a session between open and close on scheduled days. Session countdown targets the time until close.</div>
        </div>
      )}
    </div>
  );
}

/** Short one-line summary of a schedule (for tables / badges). */
export function scheduleSummary(sched) {
  if (!sched || sched.mode === "any" || !sched.mode) return "Any time";
  if (sched.mode === "fixed_hours") return `Min ${sched.min_hours_per_day || 6}h/day`;
  if (sched.mode === "weekly_calendar") {
    const w = sched.weekly_schedule || {};
    const on = DAYS.filter(([k]) => w[k]).map(([, l]) => l);
    return on.length ? `${on.join("·")} · ${sched.timezone || "UTC"}` : "No days set";
  }
  return "—";
}
