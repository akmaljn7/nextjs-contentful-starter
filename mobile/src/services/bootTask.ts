/**
 * Boot-time headless task (Phase 6).
 *
 * The Android BootReceiver (see plugins/withAndroidBootReceiver.js) starts
 * this task via TaskManagerHeadlessJsService right after
 * ACTION_BOOT_COMPLETED. It runs briefly, re-registers the office geofence
 * for the signed-in employee, and drains any offline events that piled up
 * before reboot. Idempotent — safe to run every boot.
 *
 * Registered at module top-level (mandatory for expo-task-manager tasks).
 */
import * as TaskManager from "expo-task-manager";

import { syncOfficeGeofence } from "@/services/geofence";
import { drainQueue } from "@/services/syncWorker";
import { sendHeartbeat } from "@/services/health";
import { coldStartReconcile } from "@/services/reconcile";
import { startLiveLocation, drainLocationQueue } from "@/services/liveLocation";

export const BOOT_TASK_NAME = "gfattend.boot";

TaskManager.defineTask(BOOT_TASK_NAME, async ({ error }) => {
  if (error) {
    console.warn("[boot-task] error:", error);
    return;
  }
  try {
    // Order matters: reconcile pulls state from server → registers geofence
    // with the latest office coords/radius → drains queue → heartbeat.
    // coldStartReconcile() already calls syncOfficeGeofence internally,
    // but we call it explicitly as a safety net when there's no session.
    await coldStartReconcile();
    await syncOfficeGeofence();
    // Resume WhatsApp-style continuous tracking after a reboot so live
    // streaming re-arms without the user having to open the app. Requires
    // background ("Always") location permission — no-op otherwise.
    await startLiveLocation();
    await drainQueue();
    await drainLocationQueue();
    await sendHeartbeat();
  } catch (e) {
    console.warn("[boot-task] failed:", e);
  }
});
