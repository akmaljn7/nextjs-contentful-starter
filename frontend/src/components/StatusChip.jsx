import React from "react";

const STYLE = {
  active: { cls: "border-green-500/30 bg-green-500/10 text-green-400", dot: "#10b981" },
  paused: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", dot: "#f59e0b" },
  completed: { cls: "border-blue-500/30 bg-blue-500/10 text-blue-400", dot: "#3b82f6" },
  expired: { cls: "border-red-500/30 bg-red-500/10 text-red-400", dot: "#ef4444" },
  denied: { cls: "border-red-500/30 bg-red-500/10 text-red-400", dot: "#ef4444" },
  reset: { cls: "border-white/20 bg-white/5 text-gray-400", dot: "#6b7280" },
  force_expired: { cls: "border-red-500/30 bg-red-500/10 text-red-400", dot: "#ef4444" },
  low: { cls: "border-white/20 bg-white/5 text-gray-300", dot: "#9ca3af" },
  medium: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", dot: "#f59e0b" },
  high: { cls: "border-red-500/30 bg-red-500/10 text-red-400", dot: "#ef4444" },
};

export function StatusChip({ status, label, testId }) {
  const s = STYLE[status] || STYLE.reset;
  return (
    <span className={`status-chip ${s.cls}`} data-testid={testId}>
      <span style={{ width: 6, height: 6, background: s.dot, borderRadius: 1 }} />
      {label || status}
    </span>
  );
}
