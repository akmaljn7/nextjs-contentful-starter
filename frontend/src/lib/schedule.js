/** Client-side schedule helpers — compute what the idle countdown & today's
 * shift info should look like based on the employee's schedule.
 * MUST mirror the server logic in /app/backend/routes/sessions.py::
 *   _compute_schedule_duration_ms for consistency.
 */

const DAY_KEYS_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

/** Return current time-parts in the given IANA timezone. */
function nowInTz(tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "UTC",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => { if (p.type !== "literal") map[p.type] = p.value; });
  const dayKey = (map.weekday || "").toLowerCase().slice(0, 3);
  const h = parseInt(map.hour || "0", 10);
  const m = parseInt(map.minute || "0", 10);
  const s = parseInt(map.second || "0", 10);
  return { dayKey, secondsSinceMidnight: h * 3600 + m * 60 + s };
}

function parseHHMM(s) {
  const [h, m] = String(s || "0:0").split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

/** Return the idle-state remaining_ms — what the countdown will initialize to. */
export function computeIdleRemainingMs(schedule, orgDefaultMinutes = 60) {
  const mode = schedule?.mode || "any";
  if (mode === "fixed_hours") {
    const h = Number(schedule?.min_hours_per_day) || 6;
    return h * 3600 * 1000;
  }
  if (mode === "weekly_calendar") {
    const tz = schedule?.timezone || "UTC";
    const { dayKey, secondsSinceMidnight } = nowInTz(tz);
    const day = (schedule?.weekly_schedule || {})[dayKey];
    if (!day) return 0;
    const openMin = parseHHMM(day.open);
    const closeMin = parseHHMM(day.close);
    if (closeMin <= openMin) return 0;
    const nowMin = Math.floor(secondsSinceMidnight / 60);
    if (nowMin < openMin) return (closeMin - openMin) * 60 * 1000;   // before shift → full duration
    if (nowMin >= closeMin) return 0;                                 // after shift
    return (closeMin - nowMin) * 60 * 1000 - (secondsSinceMidnight % 60) * 1000;
  }
  return orgDefaultMinutes * 60 * 1000;
}

/** Return status-string describing the current shift state. */
export function todayShiftInfo(schedule) {
  const mode = schedule?.mode || "any";
  if (mode === "any") return { headline: "", subline: "Any time — no schedule" };
  if (mode === "fixed_hours") {
    const h = Number(schedule?.min_hours_per_day) || 6;
    return { headline: `Minimum ${h}h / day`, subline: "No fixed window" };
  }
  // weekly_calendar
  const tz = schedule?.timezone || "UTC";
  const { dayKey, secondsSinceMidnight } = nowInTz(tz);
  const dayLabel = DAY_LABELS[dayKey] || dayKey.toUpperCase();
  const day = (schedule?.weekly_schedule || {})[dayKey];
  if (!day) return { headline: `${dayLabel} — day off`, subline: tz, state: "off" };
  const openMin = parseHHMM(day.open);
  const closeMin = parseHHMM(day.close);
  const nowMin = Math.floor(secondsSinceMidnight / 60);
  let state = "open";
  if (nowMin < openMin) state = "before";
  else if (nowMin >= closeMin) state = "after";
  const stateLabel = state === "open" ? "Shift open" : state === "before" ? `Starts at ${day.open}` : `Ended at ${day.close}`;
  return {
    headline: `Today: ${day.open} → ${day.close}`,
    subline: `${stateLabel} · ${tz}`,
    state,
    open: day.open,
    close: day.close,
    tz,
  };
}

/** Return an ordered list of {key, label, day: {open, close}|null} for the whole week. */
export function weeklyRows(schedule) {
  const w = schedule?.weekly_schedule || {};
  return DAY_KEYS_ORDER.map((k) => ({ key: k, label: DAY_LABELS[k], day: w[k] || null }));
}
