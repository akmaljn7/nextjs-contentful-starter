import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Application from "expo-application";
import * as Localization from "expo-localization";
import { Platform, AppState } from "react-native";

import * as authApi from "@/api/auth";
import { mobile } from "@/api/mobile";
import { getAccessToken, clearTokens } from "@/api/client";
import { getDeviceId } from "@/lib/storage";
import { syncOfficeGeofence, stopGeofencing } from "@/services/geofence";
import { startForegroundWatcher, stopForegroundWatcher } from "@/services/foregroundWatcher";
import { startLiveLocation, stopLiveLocation, drainLocationQueue } from "@/services/liveLocation";
import { coldStartReconcile } from "@/services/reconcile";
import { drainQueue } from "@/services/syncWorker";
import { startHealthLoop, stopHealthLoop } from "@/services/health";
import { startConnectivityWatcher, stopConnectivityWatcher } from "@/services/connectivity";
import { purgeOldSynced } from "@/services/offlineQueue";
import { submitAttestation } from "@/services/attestation";

interface AuthState {
  user: authApi.AuthUser | null;
  hydrating: boolean;
  loginError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<authApi.AuthUser | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const registerDeviceQuiet = useCallback(async () => {
    // Idempotent per-user register. If it fails (network) we silently continue —
    // it will be retried on the next login or app open.
    try {
      const deviceId = await getDeviceId();
      const appVersion = Application.nativeApplicationVersion || "1.0.0";
      const osVersion = Platform.Version?.toString();
      const tz = Localization.getCalendars()[0]?.timeZone || undefined;
      const locale = Localization.getLocales()[0]?.languageTag || undefined;
      await mobile.registerDevice({
        device_id: deviceId,
        platform: Platform.OS === "ios" ? "ios" : "android",
        app_version: appVersion,
        os_version: osVersion,
        tz: tz || undefined,
        locale,
      });
      // Phase 6: attach a fresh Play Integrity / App Attest proof right after
      // register-device so the server always has a recent attestation on file.
      // Failures are silently swallowed — anti-spoof is soft (flag, don't block).
      submitAttestation().catch(() => undefined);
    } catch {
      // no-op
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setHydrating(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await authApi.fetchMe();
      setUser(me);
      await registerDeviceQuiet();
      // Kick off employee-only side-effects: geofencing, reconciliation, health loop
      if (me.role === "employee") {
        // Fire and forget — these should never block UI hydration
        coldStartReconcile().catch(() => undefined);
        startHealthLoop();
        startLiveLocation().catch(() => undefined);
        startConnectivityWatcher();
        drainLocationQueue().catch(() => undefined);
        purgeOldSynced().catch(() => undefined);
      }
    } catch {
      // Auth interceptor already wiped tokens on 401 — surface gracefully
      await clearTokens();
      setUser(null);
    } finally {
      setHydrating(false);
    }
  }, [registerDeviceQuiet]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  // On app foreground: drain pending events, reconcile geofence, restart fg watcher
  useEffect(() => {
    if (!user || user.role !== "employee") return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        drainQueue().catch(() => undefined);
        drainLocationQueue().catch(() => undefined);
        syncOfficeGeofence().catch(() => undefined);
        startForegroundWatcher().catch(() => undefined);
        startLiveLocation().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    try {
      const me = await authApi.login(email, password);
      setUser(me);
      await registerDeviceQuiet();
      if (me.role === "employee") {
        coldStartReconcile().catch(() => undefined);
        startHealthLoop();
        startLiveLocation().catch(() => undefined);
        startConnectivityWatcher();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Login failed";
      setLoginError(typeof msg === "string" ? msg : "Login failed");
      throw e;
    }
  }, [registerDeviceQuiet]);

  const signOut = useCallback(async () => {
    stopHealthLoop();
    stopForegroundWatcher();
    stopConnectivityWatcher();
    await stopLiveLocation();
    await stopGeofencing();
    await authApi.logout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.fetchMe();
      setUser(me);
    } catch { /* keep current */ }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user, hydrating, loginError, signIn, signOut, refresh,
      isEmployee: user?.role === "employee",
    }),
    [user, hydrating, loginError, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function isAdminRole(role: authApi.Role | undefined): boolean {
  return role === "org_owner" || role === "admin";
}
