import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as Application from "expo-application";
import * as Localization from "expo-localization";
import { Platform, AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import * as authApi from "@/api/auth";
import { mobile } from "@/api/mobile";
import { getAccessToken } from "@/api/client";
import { getDeviceId, secureGet, secureDelete } from "@/lib/storage";
import { syncOfficeGeofence, stopGeofencing } from "@/services/geofence";
import { startForegroundWatcher, stopForegroundWatcher } from "@/services/foregroundWatcher";
import { startLiveLocation, stopLiveLocation, drainLocationQueue } from "@/services/liveLocation";
import { coldStartReconcile } from "@/services/reconcile";
import { drainQueue } from "@/services/syncWorker";
import { startHealthLoop, stopHealthLoop } from "@/services/health";
import { startConnectivityWatcher, stopConnectivityWatcher } from "@/services/connectivity";
import { startVisitWatcher, stopVisitWatcher } from "@/services/visitMonitor";
import { registerReArm, unregisterReArm } from "@/services/reArm";
import { checkLocationPermission, registerLocationWarningTapHandler } from "@/services/locationGuard";
import { purgeOldSynced } from "@/services/offlineQueue";
import { planTodaysSelfies, sweepOfflineSelfies } from "@/services/offlineSelfie";
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

// Last-known profile — lets the app stay signed in while offline (data or
// location turned off, or the server unreachable) instead of forcing a logout.
// Stored in AsyncStorage (NOT SecureStore): the profile is non-secret and can
// exceed SecureStore's ~2KB iOS Keychain limit, which previously caused the
// cache to silently fail and the app to log out whenever /me couldn't be
// reached. Never auto-cleared; only wiped on an explicit Sign out.
const CACHED_USER_KEY = "gfattend.cached_user";
const LEGACY_CACHED_USER_KEY = "cached_user"; // old SecureStore location
async function cacheUser(u: authApi.AuthUser): Promise<void> {
  try { await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)); } catch { /* ignore */ }
}
async function getCachedUser(): Promise<authApi.AuthUser | null> {
  try {
    let s = await AsyncStorage.getItem(CACHED_USER_KEY);
    if (!s) {
      // One-time migration from the old SecureStore location so existing
      // installs don't get logged out after this update.
      s = await secureGet(LEGACY_CACHED_USER_KEY);
      if (s) { try { await AsyncStorage.setItem(CACHED_USER_KEY, s); } catch { /* ignore */ } }
    }
    return s ? (JSON.parse(s) as authApi.AuthUser) : null;
  } catch { return null; }
}
async function clearCachedUser(): Promise<void> {
  try { await AsyncStorage.removeItem(CACHED_USER_KEY); } catch { /* ignore */ }
  try { await secureDelete(LEGACY_CACHED_USER_KEY); } catch { /* ignore */ }
}

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
      const cached = await getCachedUser();
      // Truly signed out ONLY when there is no token AND no cached profile
      // (fresh install, or an explicit sign-out that clears both). A missing
      // token but present cached profile is treated as a still-valid session —
      // the refresh token recovers a new access token on the next request, and
      // a transient Keychain read miss can no longer force a logout.
      if (!token && !cached) {
        setUser(null);
        return;
      }
      // NEVER log out on a failed /me: if the server is unreachable (data off,
      // preview server asleep, transient hiccup) we keep the last known profile
      // and stay signed in. The session recovers automatically once
      // connectivity returns.
      let me: authApi.AuthUser | null = cached;
      if (token) {
        try {
          me = await authApi.fetchMe();
          await cacheUser(me);
        } catch {
          me = cached;
        }
      }
      setUser(me);
      if (me) {
        registerDeviceQuiet();
        // Kick off employee-only side-effects: geofencing, reconciliation, health loop
        if (me.role === "employee") {
          // Fire and forget — these should never block UI hydration
          coldStartReconcile().catch(() => undefined);
          startHealthLoop();
          startLiveLocation().catch(() => undefined);
          startConnectivityWatcher();
          startVisitWatcher();
          registerReArm().catch(() => undefined);
          checkLocationPermission().catch(() => undefined);
          drainLocationQueue().catch(() => undefined);
          purgeOldSynced().catch(() => undefined);
          planTodaysSelfies().catch(() => undefined);
          sweepOfflineSelfies().catch(() => undefined);
        }
      }
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
        startVisitWatcher();
        checkLocationPermission().catch(() => undefined);
        planTodaysSelfies().catch(() => undefined);
        sweepOfflineSelfies().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [user]);

  // Employee-only: open the app's OS settings when a "turn on Always location"
  // warning notification is tapped.
  useEffect(() => {
    if (!user || user.role !== "employee") return;
    return registerLocationWarningTapHandler();
  }, [user]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    try {
      const me = await authApi.login(email, password);
      setUser(me);
      await cacheUser(me);
      await registerDeviceQuiet();
      if (me.role === "employee") {
        coldStartReconcile().catch(() => undefined);
        startHealthLoop();
        startLiveLocation().catch(() => undefined);
        startConnectivityWatcher();
        startVisitWatcher();
        registerReArm().catch(() => undefined);
        checkLocationPermission().catch(() => undefined);
        planTodaysSelfies().catch(() => undefined);
        sweepOfflineSelfies().catch(() => undefined);
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
    stopVisitWatcher();
    unregisterReArm().catch(() => undefined);
    await stopGeofencing();
    await authApi.logout();
    await clearCachedUser();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.fetchMe();
      setUser(me);
      await cacheUser(me);
    } catch { /* keep current — never drop the session on a failed refresh */ }
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
