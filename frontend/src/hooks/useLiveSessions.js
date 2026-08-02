import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BACKEND } from "@/lib/api";

/**
 * Subscribes to `/api/ws/live` and merges pushed session updates into the
 * ["live"] React Query cache. Falls back silently if the socket cannot connect
 * (the existing polling in the query still keeps the view fresh).
 */
export function useLiveSessions(enabled = true) {
  const qc = useQueryClient();
  const wsRef = useRef(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let closed = false;

    const connect = () => {
      if (closed) return;
      const url = BACKEND.replace(/^http/, "ws") + "/api/ws/live";
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => { retryRef.current = 0; };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "session.update" && msg.session) {
            qc.setQueryData(["live"], (prev = []) => {
              const idx = prev.findIndex((s) => s.id === msg.session.id || s.user_id === msg.session.user_id);
              if (idx === -1) return [...prev, msg.session];
              const copy = prev.slice();
              copy[idx] = { ...copy[idx], ...msg.session };
              return copy;
            });
            qc.invalidateQueries({ queryKey: ["summary"] });
          } else if (msg.type === "session.end" && msg.session) {
            qc.setQueryData(["live"], (prev = []) => prev.filter((s) => s.user_id !== msg.session.user_id));
            qc.invalidateQueries({ queryKey: ["summary"] });
            qc.invalidateQueries({ queryKey: ["attendance-records"] });
          }
        } catch { /* ignore bad frames */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closed) return;
        // Exponential backoff up to 15s
        const delay = Math.min(15000, 800 * Math.pow(1.6, retryRef.current++));
        setTimeout(connect, delay);
      };

      ws.onerror = () => { try { ws.close(); } catch { /* noop */ } };
    };

    connect();

    // Keep-alive ping every 20s
    const keep = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send("ping"); } catch { /* noop */ }
      }
    }, 20000);

    return () => {
      closed = true;
      clearInterval(keep);
      const ws = wsRef.current;
      if (ws) { try { ws.close(); } catch { /* noop */ } }
      wsRef.current = null;
    };
  }, [enabled, qc]);
}
