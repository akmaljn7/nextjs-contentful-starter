/**
 * CLVisitMonitor — thin JS bridge to the iOS-only native CLVisit module.
 *
 * iOS `startMonitoringVisits()` relaunches a force-quit app in the background
 * on arrival/departure from a place (dwell-based, tower-independent). The
 * native module persists the last visit to UserDefaults (so a cold background
 * launch never loses it) AND emits an `onVisit` event when JS is alive.
 *
 * Everything here is a safe no-op on Android / when the native module is
 * unavailable, so the same imports compile and run on both platforms.
 */
import { Platform } from "react-native";

export interface VisitEvent {
  latitude: number;
  longitude: number;
  accuracy: number;
  arrival_ms: number;
  departure_ms: number; // 0 while still present
  is_arrival: boolean;
}

export interface VisitSubscription {
  remove: () => void;
}

let nativeModule: any = null;
if (Platform.OS === "ios") {
  try {
    // Lazy require so Android (where the module isn't linked) never throws.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require("expo-modules-core");
    nativeModule = requireNativeModule("CLVisitMonitor");
  } catch {
    nativeModule = null;
  }
}

export function isVisitMonitoringAvailable(): boolean {
  return nativeModule != null;
}

export function startVisitMonitoring(): void {
  try { nativeModule?.start?.(); } catch { /* ignore */ }
}

export function stopVisitMonitoring(): void {
  try { nativeModule?.stop?.(); } catch { /* ignore */ }
}

export function getLastVisit(): VisitEvent | null {
  try { return (nativeModule?.getLastVisit?.() as VisitEvent) ?? null; }
  catch { return null; }
}

export function clearLastVisit(): void {
  try { nativeModule?.clearLastVisit?.(); } catch { /* ignore */ }
}

export function addVisitListener(cb: (e: VisitEvent) => void): VisitSubscription {
  if (!nativeModule?.addListener) return { remove: () => undefined };
  try {
    return nativeModule.addListener("onVisit", cb) as VisitSubscription;
  } catch {
    return { remove: () => undefined };
  }
}
