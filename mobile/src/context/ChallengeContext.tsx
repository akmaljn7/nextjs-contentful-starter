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
import { dueScheduledSelfie, markSelfieCaptured } from "@/services/offlineQueue";
import { drainSelfieDrafts, sweepOfflineSelfies, currentBattery } from "@/services/offlineSelfie";

interface ChallengeInfo {
  id: string;
  respond_by_ms: number;
  session_id?: string;
  manual?: boolean;
  for_name?: string;
  liveness_action?: string;
  offline?: boolean;
}

interface ChallengeState {
  active: ChallengeInfo | null;
  open: (c: ChallengeInfo) => void;
  dismiss: () => void;
  markResponded: () => void;
  cameraRequested: boolean;
  consumeCameraRequest: () => void;
  captureOfflineSelfie: (b64: string) => Promise<void>;
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
  // (staypin://selfie) — tells the modal to skip its ring screen and
  // jump straight to the camera.
  const [cameraRequested, setCameraRequested] = useState(false);
  const consumeCameraRequest = useCallback(() => setCameraRequested(false), []);
  const qc = useQueryClient();

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

  // Store an OFFLINE-captured selfie as a draft (no network needed). The
  // authoritative face-match runs server-side when the draft is synced.
  const captureOfflineSelfie = useCallback(async (b64: string) => {
    if (!active?.offline) return;
    const battery = await currentBattery();
    await markSelfieCaptured(active.id, b64, Date.now(), battery);
    drainSelfieDrafts().catch(() => undefined); // fire-and-forget (works when online)
    setActive(null);
  }, [active]);

  // Locally-scheduled offline selfie detector. The phone fires its own selfie
  // prompts (planned in offlineSelfie.ts) even with zero network. We surface a
  // due one as an `active` challenge so the SAME modal opens; on capture it's
  // stored as a draft instead of POSTed.
  const offlineSeenRef = useRef<string | null>(null);
  const checkDueOfflineSelfie = useCallback(async () => {
    if (!isEmployee) return;
    try {
      await sweepOfflineSelfies();
      const due = await dueScheduledSelfie(Date.now());
      if (due && offlineSeenRef.current !== due.client_selfie_id) {
        offlineSeenRef.current = due.client_selfie_id;
        // Don't override a live server challenge if one is already showing.
        setActive((cur) => cur ? cur : {
          id: due.client_selfie_id,
          respond_by_ms: due.respond_by_ms,
          offline: true,
          for_name: user?.name,
          liveness_action: "blink",
        });
      }
    } catch { /* best-effort */ }
  }, [isEmployee, user?.name]);

  useEffect(() => {
    if (!isEmployee) return;
    checkDueOfflineSelfie();
    const t = setInterval(checkDueOfflineSelfie, 15_000);
    return () => clearInterval(t);
  }, [isEmployee, checkDueOfflineSelfie]);

  // Deep link from the native lock-screen activity -> open camera directly.
  // The selfie push is DATA-ONLY (handled natively), so JS never learns about
  // the challenge from the push itself. Instead of waiting for the 12 s poll,
  // fetch the active challenge NOW so `active` is set and the modal can jump
  // straight to the camera. Without this the app just opens with no camera.
  useEffect(() => {
    if (!isEmployee) return;
    const handle = async (url: string | null) => {
      if (!url || !url.includes("selfie")) return;
      setCameraRequested(true);
      try {
        const data = (await api.get("/sessions/me")).data;
        const ac = data?.active_challenge;
        if (ac?.id) {
          open({
            id: ac.id,
            respond_by_ms: ac.respond_by_ms,
            manual: !!ac.manual,
            for_name: ac.for_name,
            liveness_action: ac.liveness_action,
          });
        }
      } catch { /* poll safety-net will still pick it up */ }
      qc.invalidateQueries({ queryKey: ["my-session"] });
    };
    Linking.getInitialURL().then(handle).catch(() => undefined);
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, [isEmployee, qc, open]);

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

  // Trigger an immediate poll on foreground so we don't wait up to 12 s, and
  // re-acquire + re-post the FCM push token (the backend now preserves an
  // existing token on token-less refreshes, so this can only ADD/refresh it).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && isEmployee) {
        session.refetch();
        registerForPushAsync().catch(() => undefined);
        checkDueOfflineSelfie();
      }
    });
    return () => sub.remove();
  }, [isEmployee, session]);

  const value = useMemo<ChallengeState>(
    () => ({ active, open, dismiss, markResponded, cameraRequested, consumeCameraRequest, captureOfflineSelfie }),
    [active, open, dismiss, markResponded, cameraRequested, consumeCameraRequest, captureOfflineSelfie],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChallenge(): ChallengeState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChallenge must be used within <ChallengeProvider>");
  return c;
}
