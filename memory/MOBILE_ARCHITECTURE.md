# Mobile App — Complete Architecture (agreed 5 Aug 2026)

Durable brief so any fork/session can resume without asking.

## Product vision

Install-once, background attendance app for iOS + Android. Employees walk in →
attendance auto-starts silently. Walk out → auto-pauses. Random selfie
challenges appear as push notifications. Everything works offline; syncs when
online. Admins run the whole thing from mobile OR the existing web dashboard —
one binary, dual-role routing.

## Confirmed technical stack

| Layer | Choice | Alternative if we hit trouble |
|---|---|---|
| Mobile framework | **React Native + Expo** (SDK 51+) | Capacitor (rejected — RN + Expo better testability for this user) |
| Background geofence plugin | **`expo-location`** (free, native geofencing under the hood) | Transistor's `react-native-background-geolocation` ($850 one-time) if free path drops < 90 % reliability |
| Background task runner | `expo-task-manager` | — |
| Push notifications | **Firebase Cloud Messaging** (single provider for both platforms) | APNs direct (adds iOS complexity) |
| Offline event queue | `expo-sqlite` | AsyncStorage (fallback, less durable) |
| Secure JWT storage | `expo-secure-store` (Keychain / KeyStore) | — |
| Camera | `expo-camera` | — |
| Maps (admin view) | `react-native-maps` (native Apple/Google Maps) | — |
| CI/CD | `eas build` + `eas submit` | — |
| Backend | **Existing FastAPI + MongoDB** (unchanged), +4 mobile endpoints | — |
| Face recognition | Kept **server-side (dlib)** — mobile just uploads photos | — |

## Confirmed product decisions

- ✅ Global launch from day 1 (all App Store / Play Store countries)
- ✅ Multi-timezone (already supported server-side)
- ✅ Dual role app (admin + employee share same login → route on role)
- ✅ Soft anti-spoof (flag, do not block attendance)
- ✅ No iBeacons — accept ~30 s to 3 min indoor entry delay
- ✅ English only for v1; translations later based on paying regions
- ✅ Free `expo-location` for geofencing (upgrade path preserved)

## Reliability mitigations for the free plugin (Phase 2)

Since we skip Transistor's paid plugin, we must build ~90 % of its
reliability ourselves. Non-negotiable for v1:

1. **Android boot receiver** (Expo config plugin, ~40 LOC Kotlin) — re-registers
   geofences on device boot.
2. **Cold-start reconciliation** — on every app open, foreground GPS + query
   last confirmed event from server, synthesize missing enter/exit if
   inside geofence but no active session (or vice versa).
3. **Server-side deadman timer** — if employee's schedule says they should be
   at work but no event received by expected time + 30 min, silent-push wake
   the app to force a reconciliation.
4. **iOS `startMonitoringSignificantLocationChanges`** fallback alongside
   geofencing — survives force-quit better than pure geofencing.
5. **App-side health chip** — "🟢 Attendance tracking active" turns amber if
   heartbeat missed for > 24 h; one-tap reactivate.
6. **Admin visibility** — "OFFLINE DEVICE" badge on live map + admin can
   trigger silent-push wake from the dashboard.

## New backend endpoints (Phase 0)

```
POST /api/mobile/register-device
  Body: { device_id, platform, push_token, app_version, tz, locale, os_version }
  → upserts to mobile_devices collection, one per (user_id, device_id)

POST /api/mobile/geofence-event
  Body: { client_event_id, type: "enter"|"exit", ts_ms, office_id, lat, lng,
          accuracy, tz, mock_location: bool, attestation: {...} }
  Idempotent via client_event_id (unique index).
  Server routes to session state machine — reuses existing auto-start / ping /
  force-expire logic. Uses the *client-reported ts_ms* as the effective event
  time, not the request arrival time, so an indoor 90-second delay in
  notification delivery doesn't distort attendance.

POST /api/mobile/sync
  Body: { events: [<geofence-event>...] }
  Bulk version for offline queue drainage. Same idempotency.

POST /api/mobile/heartbeat
  Body: { device_id, last_seen_ts_ms, battery, permission_state }
  Used for the "OFFLINE DEVICE" admin alert & deadman timer sanity.
```

## New MongoDB collections

- `mobile_devices` — one doc per user+device. Fields:
  `{ _id, org_id, user_id, device_id, platform, push_token, app_version,
    os_version, tz, locale, last_seen_at, permission_state, deleted_at }`
- `mobile_events` — audit/queue log for every event received.
  `{ _id, org_id, user_id, device_id, client_event_id (unique),
    type, ts_ms, coords, accuracy, mock_location, attestation,
    processed_at, session_id, outcome }`

## Existing collections **not touched**

Nothing about `active_sessions`, `attendance_records`, `users`, `offices`,
`security_events`, `admin_audit_log` changes structurally. Mobile endpoints
route through the same state machine.

## Push notification triggers (Phase 3)

Server sends FCM push when:
- New selfie challenge fires (existing `_tick_challenge_lifecycle` triggers)
- Admin manual challenge (existing `challenge-now` endpoint)
- Silent-push deadman wake (Phase 2, fix #3)
- (Admin only) High-severity security event: spoof suspected / face mismatch

## Recent web-app bug fixes carried into mobile design (as of 5 Aug 2026)

1. Session `center` (coords + radius) syncs from office record on every
   `/ping`, `/me`, `/live` — mobile inherits this. Any admin office edit
   propagates to phones on their next event.
2. Low-accuracy pings unambiguously outside geofence (dist > radius + acc)
   still pause the session. Mobile events go through the same check.
3. Ghost sessions auto-expire via stale-detection + logout ends active session.
   Mobile logout must call `/api/auth/logout` to trigger this.
4. Duplicate employee create returns 409 with reason-specific detail.
5. Face baseline enrollment must be nudged pre-shift; mobile home banner
   mirrors the web banner (`face-enroll-nudge` component).
6. Admin can drag office pin — mobile `react-native-maps` must implement the
   same for admins-on-mobile editing offices.

## Timeline commit

- P0 — Backend prep — 3–4 days
- P1 — App shell + login + role routing — 1 week
- P2 — Employee flow: BG geofence + offline queue + 6 reliability fixes — 2 weeks
- P3 — Employee flow: push + selfie challenge — 1 week
- P4 — Admin flow: live map + core actions — 1.5 weeks
- P5 — Admin flow: offices/employees/reports — 1.5 weeks
- P6 — Anti-spoof, polish, error UX — 1 week
- P7 — Real-device testing — 1 week
- P8 — Store submission + review — 2–3 weeks
- **Total 11–13 weeks; ~$425–1225 one-time + $99/yr**

## Testing protocol per phase

- Backend changes → curl round-trip + `testing_agent`
- Frontend changes → screenshot + `testing_agent` for UI flows
- Real-device tests only in P7 (Expo Dev Client + TestFlight/Play Internal)

## Location layout

- Web app: unchanged at `/app/frontend/` and `/app/backend/`
- Mobile app: new folder **`/app/mobile/`** — separate `package.json`, own
  Expo project. Shares nothing at build-time, calls same API endpoints.
