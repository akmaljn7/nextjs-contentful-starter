/**
 * Offline scheduled selfies — the anti-cheat core.
 *
 * Problem: online-only selfies let an employee switch off data, drop the phone
 * on the desk, walk away, and answer the selfie later when they reconnect.
 *
 * Fix: the PHONE schedules the selfies for the day at unpredictable random
 * times (count comes from the admin's `selfie_challenges_per_shift`) and fires
 * them LOCALLY — with zero network — via OS scheduled notifications. When the
 * prompt fires the employee proves a live face on-device (blink) and the frame
 * is stored as a draft in SQLite. If they aren't there to complete it within
 * the response window it's saved as a MISSED draft with the real timestamp.
 * On reconnect every draft is replayed to /api/mobile/selfie-sync, where the
 * server runs the authoritative face-match and flags mismatches / misses.
 *
 * The identity match stays server-side (dlib) — it can't run in RN and a
 * server verdict is un-fakeable. Offline we only prove liveness + stamp time.
 */
import * as Notifications from "expo-notifications";
import * as Battery from "expo-battery";

import { mobile, SelfieConfig } from "@/api/mobile";
import {
  insertScheduledSelfie, hasPlannedForDay, expireOverdueSelfies,
  pendingSelfieDrafts, markSelfieDraftsSynced, purgeOldSelfies,
} from "@/services/offlineQueue";

const DEFAULT_WINDOW = { openMin: 9 * 60, closeMin: 18 * 60 }; // 09:00–18:00 local
const BUFFER_MS = 3 * 60 * 1000;

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rid(): string {
  return `os_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Local-day absolute ms for a HH:MM (device local time). */
function todayAtMinutes(mins: number): number {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.getTime();
}

/** Resolve today's on-shift window [openMs, closeMs] from the schedule. */
function shiftWindow(schedule: any): { openMs: number; closeMs: number } {
  try {
    if (schedule?.mode === "weekly" && schedule?.weekly_schedule) {
      const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const day = schedule.weekly_schedule[keys[new Date().getDay()]];
      if (day?.open && day?.close) {
        const [oh, om] = String(day.open).split(":").map(Number);
        const [ch, cm] = String(day.close).split(":").map(Number);
        const openMs = todayAtMinutes(oh * 60 + om);
        const closeMs = todayAtMinutes(ch * 60 + cm);
        if (closeMs > openMs) return { openMs, closeMs };
      }
    }
  } catch { /* fall through to default */ }
  return { openMs: todayAtMinutes(DEFAULT_WINDOW.openMin), closeMs: todayAtMinutes(DEFAULT_WINDOW.closeMin) };
}

/** Random trigger times across the shift (mirrors the backend's slot logic). */
function randomTriggers(count: number, openMs: number, closeMs: number): number[] {
  const span = closeMs - openMs;
  if (count <= 0 || span <= 0) return [];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const slotStart = openMs + Math.floor((span * i) / count) + BUFFER_MS;
    const slotEnd = openMs + Math.floor((span * (i + 1)) / count) - BUFFER_MS;
    if (slotEnd <= slotStart) continue;
    out.push(slotStart + Math.floor(Math.random() * (slotEnd - slotStart)));
  }
  return out.sort((a, b) => a - b);
}

/** Fixed-time triggers (selfie_mode='fixed'): HH:MM local, today. */
function fixedTriggers(times: string[], count: number): number[] {
  const out: number[] = [];
  for (const hhmm of (times || []).slice(0, count)) {
    const [h, m] = String(hhmm).split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) out.push(todayAtMinutes(h * 60 + m));
  }
  return out.sort((a, b) => a - b);
}

/**
 * Plan today's selfies once (idempotent per local day). Fetches the current
 * config from /reconcile; if that fails while offline, falls back to the
 * supplied cached config so scheduling still happens.
 */
export async function planTodaysSelfies(cached?: { config?: SelfieConfig; schedule?: any }): Promise<number> {
  const key = dayKey();
  if (await hasPlannedForDay(key)) return 0;

  let config = cached?.config;
  let schedule = cached?.schedule;
  try {
    const rec = await mobile.reconcile();
    config = rec.selfie_config || config;
    schedule = rec.schedule || schedule;
  } catch { /* offline — use cached */ }

  const count = Math.max(0, Number(config?.challenges_per_shift ?? 0));
  if (!count) return 0;
  const windowMin = Math.max(1, Number(config?.response_window_minutes ?? 5));

  const { openMs, closeMs } = shiftWindow(schedule);
  const triggers = config?.mode === "fixed" && (config?.fixed_times?.length ?? 0) > 0
    ? fixedTriggers(config!.fixed_times, count)
    : randomTriggers(count, openMs, closeMs);

  let planned = 0;
  for (const trigger_ms of triggers) {
    const respond_by_ms = trigger_ms + windowMin * 60 * 1000;
    // Only schedule ones whose window hasn't already closed.
    if (respond_by_ms <= Date.now()) continue;
    const id = rid();
    await insertScheduledSelfie({ client_selfie_id: id, day_key: key, scheduled_ms: trigger_ms, respond_by_ms });
    planned++;
    // OS-level local notification so the phone rings the prompt even when the
    // app is killed and completely offline.
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Selfie check-in",
          body: "Take a quick selfie now — look at the camera and blink.",
          data: { kind: "offline_selfie", client_selfie_id: id },
          sound: "selfie_alert.wav",
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(trigger_ms) } as any,
      });
    } catch { /* notification scheduling is best-effort */ }
  }
  return planned;
}

/** Upload captured + missed drafts. Safe to call repeatedly (idempotent server-side). */
export async function drainSelfieDrafts(): Promise<{ synced: number }> {
  const drafts = await pendingSelfieDrafts(25);
  if (!drafts.length) return { synced: 0 };
  try {
    await mobile.selfieSync(
      drafts.map((d) => ({
        client_selfie_id: d.client_selfie_id,
        scheduled_ms: d.scheduled_ms,
        respond_by_ms: d.respond_by_ms,
        captured_ms: d.captured_ms ?? undefined,
        outcome: (d.outcome || "missed") as "captured" | "missed",
        face_photo: d.photo ?? undefined,
        client_liveness: !!d.client_liveness,
        battery: d.battery ?? undefined,
      })),
    );
    await markSelfieDraftsSynced(drafts.map((d) => d.client_selfie_id));
    purgeOldSelfies().catch(() => undefined);
    return { synced: drafts.length };
  } catch {
    return { synced: 0 };
  }
}

/** Mark any overdue scheduled selfies as missed, then try to drain. */
export async function sweepOfflineSelfies(): Promise<void> {
  await expireOverdueSelfies(Date.now()).catch(() => undefined);
  await drainSelfieDrafts().catch(() => undefined);
}

export async function currentBattery(): Promise<number | undefined> {
  try {
    const lvl = await Battery.getBatteryLevelAsync();
    return lvl >= 0 ? lvl : undefined;
  } catch {
    return undefined;
  }
}
