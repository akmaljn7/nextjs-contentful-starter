/**
 * Android periodic re-arm (WorkManager via expo-background-fetch).
 *
 * A swiped-away Android app loses its foreground-service location stream until
 * something re-arms it. Native geofences survive, but on aggressive OEMs even
 * those can be suppressed. WorkManager jobs, however, are persisted by the OS
 * and keep running after a swipe-away (`stopOnTerminate:false`) and across a
 * reboot (`startOnBoot:true`) — so this periodic task rebuilds the whole
 * tracking stack without waiting for a reboot or the user reopening the app.
 *
 * Runs at most every 15 min (OS-enforced floor). On iOS this rides BGTask
 * scheduler (a bonus while backgrounded; SLC + CLVisit cover the force-quit
 * case there). Registered at module top-level so the OS can wake it.
 */
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

import { coldStartReconcile } from "@/services/reconcile";
import { syncOfficeGeofence } from "@/services/geofence";
import { startLiveLocation, drainLocationQueue } from "@/services/liveLocation";
import { drainQueue } from "@/services/syncWorker";
import { sendHeartbeat } from "@/services/health";
import { logWake } from "@/services/wakeLog";

export const REARM_TASK = "gfattend.rearm";
const MIN_INTERVAL_S = 15 * 60;

TaskManager.defineTask(REARM_TASK, async () => {
  try {
    logWake("rearm").catch(() => undefined);
    await coldStartReconcile();
    await syncOfficeGeofence();
    await startLiveLocation();
    await drainQueue();
    await drainLocationQueue();
    await sendHeartbeat();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerReArm(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    await BackgroundFetch.registerTaskAsync(REARM_TASK, {
      minimumInterval: MIN_INTERVAL_S,
      stopOnTerminate: false, // Android: keep re-arming after swipe-away
      startOnBoot: true,      // Android: re-register after reboot
    });
  } catch {
    /* ignore — best-effort */
  }
}

export async function unregisterReArm(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(REARM_TASK)) {
      await BackgroundFetch.unregisterTaskAsync(REARM_TASK);
    }
  } catch {
    /* ignore */
  }
}
