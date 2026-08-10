/**
 * Selfie challenge state — a small store that lets any screen open the
 * challenge modal in response to a push, a poll, or a local test button.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { subscribeChallenges, registerForPushAsync } from "@/services/push";
import { useAuth } from "@/context/AuthContext";

interface ChallengeInfo {
  id: string;
  respond_by_ms: number;
  session_id?: string;
  manual?: boolean;
  for_name?: string;
  liveness_action?: string;
}

interface ChallengeState {
  active: ChallengeInfo | null;
  open: (c: ChallengeInfo) => void;
  dismiss: () => void;
  markResponded: () => void;
  cameraRequested: boolean;
  consumeCameraRequest: () => void;
}

const Ctx = createContext<ChallengeState | null>(null);

/**
 * Detects a selfie challenge via three complementary paths:
 *   1. FCM push (primary, works while backgrounded)
 *   2. Foreground polling of /api/sessions/me every 12 s (safety net when
 *      FCM_SERVICE_ACCOUNT_JSON isn't configured on the server yet)
 *   3. Manual open() call from a test/debug button
 *
 * All three converge on the same modal via `active`.
 */
export function ChallengeProvider({ children }: { children: React.ReactNode }) {
  const { user, isEmployee } = useAuth();
  const [active, setActive] = useState<ChallengeInfo | null>(null);
  // Set when the native full-screen "OPEN CAMERA" button deep-links us in
  // (geofenceattendance://selfie) — tells the modal to skip its ring screen and
  // jump straight to the camera.
  const [cameraRequested, setCameraRequested] = useState(false);
  const consumeCameraRequest = useCallback(() => setCameraRequested(false), []);
  const qc = useQueryClient();

  // Deep link from the native lock-screen activity -> open camera directly.
  useEffect(() => {
    if (!isEmployee) return;
    const handle = (url: string | null) => {
      if (url && url.includes("selfie")) {
        setCameraRequested(true);
        qc.invalidateQueries({ queryKey: ["my-session"] });
      }
    };
    Linking.getInitialURL().then(handle).catch(() => undefined);
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, [isEmployee, qc]);

  const open = useCallback((c: ChallengeInfo) => {
    // Ignore expired triggers that a delayed push might carry
    if (c.respond_by_ms && c.respond_by_ms < Date.now()) return;
    setActive(c);
  }, []);
  const dismiss = useCallback(() => setActive(null), []);
  const markResponded = useCallback(() => {
    setActive(null);
    qc.invalidateQueries({ queryKey: ["my-session"] });
    qc.invalidateQueries({ queryKey: ["mobile-reconcile"] });
  }, [qc]);

  // Push subscription
  useEffect(() => {
    if (!isEmployee) return;
    registerForPushAsync().catch(() => undefined);
    const unsub = subscribeChallenges((c) => {
      open({ id: c.challenge_id, respond_by_ms: c.respond_by_ms,
              session_id: c.session_id, manual: c.manual, for_name: c.for_name,
              liveness_action: c.liveness_action });
    });
    return unsub;
  }, [isEmployee, open]);

  // Foreground polling safety-net
  const session = useQuery<any>({
    queryKey: ["my-session"],
    queryFn: async () => (await api.get("/sessions/me")).data,
    refetchInterval: isEmployee ? 12_000 : false,
    enabled: !!user && isEmployee,
  });
  const activeChallenge = session.data?.active_challenge;
  const lastSeenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeChallenge?.id) return;
    if (lastSeenRef.current === activeChallenge.id) return;
    if (activeChallenge.status !== "pending") return;
    lastSeenRef.current = activeChallenge.id;
    open({
      id: activeChallenge.id,
      respond_by_ms: activeChallenge.respond_by_ms,
      manual: !!activeChallenge.manual,
      for_name: activeChallenge.for_name,
      liveness_action: activeChallenge.liveness_action,
    });
  }, [activeChallenge?.id, activeChallenge?.status, activeChallenge?.respond_by_ms, open]);

  // Trigger an immediate poll on foreground so we don't wait up to 12 s
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && isEmployee) session.refetch();
    });
    return () => sub.remove();
  }, [isEmployee, session]);

  const value = useMemo<ChallengeState>(
    () => ({ active, open, dismiss, markResponded, cameraRequested, consumeCameraRequest }),
    [active, open, dismiss, markResponded, cameraRequested, consumeCameraRequest],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChallenge(): ChallengeState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChallenge must be used within <ChallengeProvider>");
  return c;
}
