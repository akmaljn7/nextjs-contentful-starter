/**
 * SQLite-backed offline event queue.
 *
 * When the app is offline (or a background task can't reach the network),
 * geofence events are stored here with a client_event_id so they can be
 * safely replayed when connectivity returns without creating duplicates
 * on the server.
 *
 * Table: mobile_events
 *   id           INTEGER PK AUTOINCREMENT
 *   client_event_id TEXT UNIQUE  — matches server-side dedup key
 *   type         TEXT NOT NULL   — 'enter' | 'exit' | 'cold_start_reconcile'
 *   ts_ms        INTEGER NOT NULL
 *   office_id    TEXT NOT NULL
 *   lat          REAL NOT NULL
 *   lng          REAL NOT NULL
 *   accuracy     REAL NOT NULL
 *   mock_location INTEGER NOT NULL DEFAULT 0
 *   from_boot    INTEGER NOT NULL DEFAULT 0
 *   battery      REAL
 *   device_id    TEXT NOT NULL
 *   synced_at    INTEGER          — null if not yet synced
 *   sync_error   TEXT             — last sync error message
 *   attempts     INTEGER NOT NULL DEFAULT 0
 *   created_at   INTEGER NOT NULL
 */
import * as SQLite from "expo-sqlite";

const DB_NAME = "gfattend.db";

let _db: SQLite.SQLiteDatabase | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mobile_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_event_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      ts_ms INTEGER NOT NULL,
      office_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL NOT NULL,
      mock_location INTEGER NOT NULL DEFAULT 0,
      from_boot INTEGER NOT NULL DEFAULT 0,
      battery REAL,
      device_id TEXT NOT NULL,
      synced_at INTEGER,
      sync_error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_unsynced
      ON mobile_events (synced_at, created_at);
    CREATE TABLE IF NOT EXISTS mobile_location_fixes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts_ms INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL NOT NULL,
      speed REAL,
      battery REAL,
      mock_location INTEGER NOT NULL DEFAULT 0,
      device_id TEXT NOT NULL,
      synced_at INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_locfix_unsynced
      ON mobile_location_fixes (synced_at, ts_ms);
    CREATE TABLE IF NOT EXISTS offline_selfies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_selfie_id TEXT NOT NULL UNIQUE,
      day_key TEXT NOT NULL,
      scheduled_ms INTEGER NOT NULL,
      respond_by_ms INTEGER NOT NULL,
      captured_ms INTEGER,
      outcome TEXT,
      photo TEXT,
      client_liveness INTEGER NOT NULL DEFAULT 0,
      battery REAL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      synced_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_selfie_status
      ON offline_selfies (status, scheduled_ms);
  `);
  return _db;
}

export interface QueuedEvent {
  id?: number;
  client_event_id: string;
  type: "enter" | "exit" | "cold_start_reconcile";
  ts_ms: number;
  office_id: string;
  lat: number;
  lng: number;
  accuracy: number;
  mock_location?: boolean;
  from_boot?: boolean;
  battery?: number | null;
  device_id: string;
}

export async function enqueue(event: QueuedEvent): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR IGNORE INTO mobile_events
     (client_event_id, type, ts_ms, office_id, lat, lng, accuracy, mock_location,
      from_boot, battery, device_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.client_event_id, event.type, event.ts_ms, event.office_id,
      event.lat, event.lng, event.accuracy,
      event.mock_location ? 1 : 0, event.from_boot ? 1 : 0,
      event.battery ?? null, event.device_id, Date.now(),
    ],
  );
}

export async function pendingEvents(limit = 100): Promise<QueuedEvent[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>(
    `SELECT * FROM mobile_events WHERE synced_at IS NULL
     ORDER BY ts_ms ASC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    client_event_id: r.client_event_id,
    type: r.type,
    ts_ms: r.ts_ms,
    office_id: r.office_id,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
    mock_location: !!r.mock_location,
    from_boot: !!r.from_boot,
    battery: r.battery ?? undefined,
    device_id: r.device_id,
  }));
}

export async function markSynced(clientEventIds: string[]): Promise<void> {
  if (!clientEventIds.length) return;
  const d = await db();
  const now = Date.now();
  const placeholders = clientEventIds.map(() => "?").join(",");
  await d.runAsync(
    `UPDATE mobile_events SET synced_at = ?, sync_error = NULL
     WHERE client_event_id IN (${placeholders})`,
    [now, ...clientEventIds],
  );
}

export async function markFailed(clientEventIds: string[], errMsg: string): Promise<void> {
  if (!clientEventIds.length) return;
  const d = await db();
  const placeholders = clientEventIds.map(() => "?").join(",");
  await d.runAsync(
    `UPDATE mobile_events SET attempts = attempts + 1, sync_error = ?
     WHERE client_event_id IN (${placeholders})`,
    [errMsg.slice(0, 250), ...clientEventIds],
  );
}

/** Delete synced events older than 7 days to keep the DB small. */
export async function purgeOldSynced(): Promise<number> {
  const d = await db();
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
  const res = await d.runAsync(
    `DELETE FROM mobile_events WHERE synced_at IS NOT NULL AND synced_at < ?`,
    [cutoff],
  );
  return res.changes ?? 0;
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM mobile_events WHERE synced_at IS NULL`,
  );
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Live-location fixes (WhatsApp-style continuous tracking, offline-durable)
// ---------------------------------------------------------------------------
export interface QueuedLocationFix {
  id?: number;
  ts_ms: number;
  lat: number;
  lng: number;
  accuracy: number;
  speed?: number | null;
  battery?: number | null;
  mock_location?: boolean;
  device_id: string;
}

export async function enqueueLocationFix(fix: QueuedLocationFix): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO mobile_location_fixes
     (ts_ms, lat, lng, accuracy, speed, battery, mock_location, device_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fix.ts_ms, fix.lat, fix.lng, fix.accuracy,
      fix.speed ?? null, fix.battery ?? null,
      fix.mock_location ? 1 : 0, fix.device_id, Date.now(),
    ],
  );
}

export async function pendingLocationFixes(limit = 300): Promise<QueuedLocationFix[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>(
    `SELECT * FROM mobile_location_fixes WHERE synced_at IS NULL
     ORDER BY ts_ms ASC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    ts_ms: r.ts_ms,
    lat: r.lat,
    lng: r.lng,
    accuracy: r.accuracy,
    speed: r.speed ?? undefined,
    battery: r.battery ?? undefined,
    mock_location: !!r.mock_location,
    device_id: r.device_id,
  }));
}

export async function markLocationSynced(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const d = await db();
  const now = Date.now();
  const placeholders = ids.map(() => "?").join(",");
  await d.runAsync(
    `UPDATE mobile_location_fixes SET synced_at = ? WHERE id IN (${placeholders})`,
    [now, ...ids],
  );
}

export async function markLocationFailed(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const d = await db();
  const placeholders = ids.map(() => "?").join(",");
  await d.runAsync(
    `UPDATE mobile_location_fixes SET attempts = attempts + 1 WHERE id IN (${placeholders})`,
    ids,
  );
}

/** Delete synced fixes older than 2 days — live fixes are high-volume. */
export async function purgeOldLocationFixes(): Promise<number> {
  const d = await db();
  const cutoff = Date.now() - 2 * 24 * 3600 * 1000;
  const res = await d.runAsync(
    `DELETE FROM mobile_location_fixes WHERE synced_at IS NOT NULL AND synced_at < ?`,
    [cutoff],
  );
  return res.changes ?? 0;
}

// ---------------------------------------------------------------------------
// Offline scheduled selfies (fire + capture on-device with zero network,
// verified server-side on reconnect).
// status: 'scheduled' → 'captured' | 'missed' → (uploaded) 'synced'
// ---------------------------------------------------------------------------
export interface OfflineSelfieRow {
  id?: number;
  client_selfie_id: string;
  day_key: string;
  scheduled_ms: number;
  respond_by_ms: number;
  captured_ms?: number | null;
  outcome?: "captured" | "missed" | null;
  photo?: string | null;
  client_liveness?: boolean;
  battery?: number | null;
  status: "scheduled" | "captured" | "missed" | "synced";
}

/** Insert a planned selfie (status='scheduled'). No-op if already planned. */
export async function insertScheduledSelfie(row: {
  client_selfie_id: string; day_key: string; scheduled_ms: number; respond_by_ms: number;
}): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT OR IGNORE INTO offline_selfies
     (client_selfie_id, day_key, scheduled_ms, respond_by_ms, client_liveness, status, created_at)
     VALUES (?, ?, ?, ?, 0, 'scheduled', ?)`,
    [row.client_selfie_id, row.day_key, row.scheduled_ms, row.respond_by_ms, Date.now()],
  );
}

/** True if selfies were already planned for this local day. */
export async function hasPlannedForDay(dayKey: string): Promise<boolean> {
  const d = await db();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM offline_selfies WHERE day_key = ?`, [dayKey],
  );
  return (row?.n ?? 0) > 0;
}

/** The single selfie whose window is open right now (scheduled + not past). */
export async function dueScheduledSelfie(now: number): Promise<OfflineSelfieRow | null> {
  const d = await db();
  const r = await d.getFirstAsync<any>(
    `SELECT * FROM offline_selfies
     WHERE status = 'scheduled' AND scheduled_ms <= ? AND respond_by_ms >= ?
     ORDER BY scheduled_ms ASC LIMIT 1`,
    [now, now],
  );
  return r ? mapSelfie(r) : null;
}

/** Store the captured frame for a due selfie. */
export async function markSelfieCaptured(
  clientSelfieId: string, photo: string, capturedMs: number, battery?: number | null,
): Promise<void> {
  const d = await db();
  await d.runAsync(
    `UPDATE offline_selfies
     SET status = 'captured', outcome = 'captured', photo = ?, captured_ms = ?,
         client_liveness = 1, battery = ?
     WHERE client_selfie_id = ?`,
    [photo, capturedMs, battery ?? null, clientSelfieId],
  );
}

/** Any scheduled selfie whose response window has fully elapsed → 'missed'. */
export async function expireOverdueSelfies(now: number): Promise<number> {
  const d = await db();
  const res = await d.runAsync(
    `UPDATE offline_selfies SET status = 'missed', outcome = 'missed'
     WHERE status = 'scheduled' AND respond_by_ms < ?`,
    [now],
  );
  return res.changes ?? 0;
}

/** Drafts ready to upload (captured or missed, not yet synced). */
export async function pendingSelfieDrafts(limit = 25): Promise<OfflineSelfieRow[]> {
  const d = await db();
  const rows = await d.getAllAsync<any>(
    `SELECT * FROM offline_selfies
     WHERE status IN ('captured', 'missed') AND synced_at IS NULL
     ORDER BY scheduled_ms ASC LIMIT ?`,
    [limit],
  );
  return rows.map(mapSelfie);
}

export async function markSelfieDraftsSynced(clientSelfieIds: string[]): Promise<void> {
  if (!clientSelfieIds.length) return;
  const d = await db();
  const now = Date.now();
  const ph = clientSelfieIds.map(() => "?").join(",");
  await d.runAsync(
    `UPDATE offline_selfies SET status = 'synced', synced_at = ?, photo = NULL
     WHERE client_selfie_id IN (${ph})`,
    [now, ...clientSelfieIds],
  );
}

/** Delete synced/old selfies older than 3 days. */
export async function purgeOldSelfies(): Promise<number> {
  const d = await db();
  const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
  const res = await d.runAsync(
    `DELETE FROM offline_selfies
     WHERE (synced_at IS NOT NULL AND synced_at < ?) OR created_at < ?`,
    [cutoff, cutoff],
  );
  return res.changes ?? 0;
}

function mapSelfie(r: any): OfflineSelfieRow {
  return {
    id: r.id,
    client_selfie_id: r.client_selfie_id,
    day_key: r.day_key,
    scheduled_ms: r.scheduled_ms,
    respond_by_ms: r.respond_by_ms,
    captured_ms: r.captured_ms ?? null,
    outcome: r.outcome ?? null,
    photo: r.photo ?? null,
    client_liveness: !!r.client_liveness,
    battery: r.battery ?? null,
    status: r.status,
  };
}
