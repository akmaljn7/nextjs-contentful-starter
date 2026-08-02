export function msToHMS(ms) {
  if (ms == null || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s, str: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

export function fmtCoord(v) {
  return typeof v === "number" ? v.toFixed(6) : "—";
}

export function fmtDist(m) {
  if (m == null) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
  } catch { return iso; }
}

export function fmtMinutes(ms) {
  if (!ms) return "0 min";
  const m = ms / 60000;
  return m < 60 ? `${m.toFixed(1)} min` : `${(m / 60).toFixed(2)} h`;
}

export const STATUS_LABEL = {
  active: "ACTIVE",
  paused: "PAUSED",
  completed: "COMPLETED",
  expired: "EXPIRED",
  denied: "DENIED",
  reset: "RESET",
  force_expired: "FORCED",
};
