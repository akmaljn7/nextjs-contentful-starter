import React, { useEffect, useRef, useState } from "react";
import { msToHMS } from "@/lib/format";

/**
 * Displays a client-side countdown driven by server-provided `remaining_ms`.
 * Re-syncs whenever remaining_ms prop changes; ticks locally each second when active.
 */
export function CountdownTimer({ remainingMs, active, testId }) {
  const [local, setLocal] = useState(remainingMs);
  const anchor = useRef({ ms: remainingMs, t: Date.now() });

  useEffect(() => {
    anchor.current = { ms: remainingMs ?? 0, t: Date.now() };
    setLocal(remainingMs ?? 0);
  }, [remainingMs]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - anchor.current.t;
      setLocal(Math.max(0, anchor.current.ms - elapsed));
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  const { str } = msToHMS(local);
  return (
    <div className="timer-digits text-5xl sm:text-6xl tracking-tight" data-testid={testId}>
      {str}
    </div>
  );
}
