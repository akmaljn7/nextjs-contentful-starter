# Geofence Attendance Console — PRD & Delivery Log

## Original Problem Statement
Multi-tenant enterprise geofenced attendance platform. Organizations sign up, admins define offices with GPS geofences, employees clock in only when physically inside their assigned radius. Sessions run 60-minute countdowns with pause-on-exit / resume-within-10-hours logic. Admins get a live satellite-map dashboard with real-time employee pins and immutable audit history.

## Personas
- **Org Owner** — creates the org, manages settings, has full admin rights
- **Admin** — office/employee CRUD, dashboard, reports
- **Employee** — starts sessions, streams GPS, views own history
- **Super Admin** — cross-tenant support (future)

## Static Core Requirements
- Multi-tenant isolation by `org_id` at DB + API layer
- Email/password auth with JWT (15 min) + rotating refresh (7 day)
- bcrypt password hashing (cost 12), 5-fail lockout, password reset via email
- RBAC roles: super_admin, org_owner, admin, employee
- Server-side geofence validation (Haversine)
- Anti-spoof: accuracy filter, impossible-speed guard
- Immutable hash-chained attendance records (SOC2 baseline)
- 90-day TTL on raw GPS pings (GDPR data-minimization)
- Admin audit log + security event log
- Dark ops-console theme (Inter + IBM Plex Mono)
- PWA installable

## Implemented (2026-02 → 2026-08)
### False coverage gaps on idle phones — battery-optimization exemption (June 2026)
- **Problem**: an idle phone (screen off, on a desk, online) stopped streaming live location for ~18 min, then logged a false "suspicious" coverage gap the moment it was picked up. Root cause: Android **Doze** freezes the foreground-service location updates unless the app is exempt from battery optimization; heartbeats (JS setInterval) also freeze, so the server can't tell a Doze-throttle from a real power-off.
- **Fix (mobile, option A)**: request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` so Doze no longer defers the 15s stream. Added the permission to `app.json`; new `services/batteryOptimization.ts` launches the system exemption dialog (fallback to the battery-settings list) with a one-time SecureStore flag; wired as an Android-only onboarding step in `PermissionsScreen.tsx` and as a one-time post-onboarding prompt in `HomeScreen.tsx`. WAKE_LOCK already declared.
- **Verified**: `yarn typecheck` clean; Android Metro bundle builds (1365 modules incl. `expo-intent-launcher`). ⚠️ Doze behaviour can only be confirmed on a real APK — user to verify.

### Face-enroll selfie crash + free liveness plan (June 2026)
- **Stopgap fix (shipped)**: `CameraCapture.tsx` now downscales to 512px + compresses via `expo-image-manipulator` before upload (was sending a full-res ~2–5MB base64 → 413/422 "error"). Payload now ~40–80KB. ⚠️ Needs real-device confirmation.
- **Liveness decision**: user wants a **free** solution. Chosen path (pending go-ahead): server-side passive liveness via MiniFASNet (Silent-Face-Anti-Spoofing) on enrollment + selfie check-ins; optional Phase 2 on-device active blink/turn challenge. NOT yet implemented.

### GPS jitter — impossible-speed filter only, exits log immediately (June 2026)
- **Change**: removed the 3-minute exit debounce. A real (plausible-speed) outside fix now pauses the session **immediately** with a `pause_live` crossing at the fix ts (no backdating, no delay). The only remaining jitter guard is the **impossible-speed filter** (>55 m/s over <120s with ≥100m displacement → `rejected_gps_glitch`, state unchanged). Dead `EXIT_GRACE_MS` constant + comment removed from `routes/mobile.py`.
- **Tests updated**: `test_gps_jitter_suppression.py` (immediate pause + resume + teleport reject) and `test_inside_time_double_count_fix.py` (single outside pauses now; offline batch first-outside pauses, next stays paused). 8/8 pass serially (`-n0`).
- **Rationale (user request)**: the debounce delayed genuine exits from being logged; the impossible-speed filter alone is enough to drop GPS teleport spikes.

### GPS jitter suppression — no phantom OUT/IN crossings (8 Aug 2026, SUPERSEDED)
- **Problem**: GPS spikes momentarily threw an employee outside then back inside, creating phantom OUT/IN entries + pause/resume flicker on the admin console.
- **Fix (server-side, `_apply_location_fix`)**:
  - **Exit debounce (3-min grace)**: a `definitely_outside` fix no longer pauses/logs immediately — it sets `pending_exit_ms` and keeps the session ACTIVE (`exit_pending`). If the employee returns inside within `EXIT_GRACE_MS` (3 min) it's treated as jitter (no log, no pause; the excursion span isn't counted). Only sustained-outside beyond 3 min confirms a real exit and logs a `pause_live` crossing **backdated** to when they first left.
  - **Impossible-speed filter**: a fix implying >`MAX_PLAUSIBLE_SPEED_MPS` (55 m/s ≈ 198 km/h) over a short (<120s) interval with ≥100m displacement is a teleport spike → **discarded** (`rejected_gps_glitch`), no state change, no ping/log.
- **Verified** (testing agent iteration_26, 8/8): brief 400m excursion returning in 60s → stays active, 0 crossings; sustained exit → one backdated pause; 3km/5s jump → rejected at ~600 m/s; total_inside not double-counted; offline batch + coverage-gap regressions pass. New test `test_gps_jitter_suppression.py`; `test_inside_time_double_count_fix.py` updated to debounce semantics.

### Bug fixes: inside-time double-count + offline auto-push (8 Aug 2026)
- **Inside-time was double-counting** — `_apply_location_fix` accrued time INCREMENTALLY on every inside fix AND added the whole bout again on pause. Fixed: the live pause branch now only flips to paused (incremental-only, matching canonical `ping_session`). Also guarded `_apply_geofence_event` exit to add bout time ONLY for pure geofence-only sessions (no `last_live_ts_ms`), so the geofence pipeline doesn't double-count with live incremental. Verified (testing agent iteration_25, 4/4): 3 inside fixes 15s apart + one outside → `total_inside_ms=30000` (was 75000); resume + accrue → 45000; offline batch → 120000 & idempotent; >10min gap still excluded.
- **Offline movements now auto-push on reconnect (mobile)** — root cause: `distanceInterval: 25` made Android withhold time-based fixes while the employee was stationary, so a still/back-online phone never triggered a drain until it moved or the app opened. Fixed: `distanceInterval: 0` (pure 15s time-based fixes even when stationary) + a new `connectivity.ts` NetInfo listener that drains both offline queues the instant the network returns (started for employees in AuthContext, stopped on sign-out). Added `@react-native-community/netinfo`. ⚠️ Mobile-runtime behaviour needs real-APK confirmation (not testable in-container); verified by typecheck + Android bundle.

### Device binding + per-employee logout lock (8 Aug 2026)
- **Device binding (mobile only, employees):** first phone an employee logs in from **auto-binds** (`users.bound_device_id`). A *different* device creates a pending `device_requests` row and the app shows a blocked **"Waiting for manager's approval"** screen (polls status, auto-unlocks on approval). Manager approves/rejects **inline on the web Employees page** (banner with Approve/Reject); Reset unbinds a phone (e.g. new device). Owners/admins bypass binding. Endpoints: `POST /api/mobile/device/bind`, `GET /api/mobile/device/status`, `GET/POST /api/employees/device-requests*`, `POST /api/employees/{id}/reset-device`. Mobile: `EmployeeRoot` device gate (before face gate) + `WaitingApprovalScreen`; device_id from `getDeviceId()` (iOS IDFV / Android ID).
- **Per-employee logout lock:** employee mobile Profile **Sign out is disabled by default** (`users.logout_enabled=false`); shows a "disabled by your manager" note. Admin toggles it per-employee on the web Employees page (**Logout ON/OFF** button). `/api/auth/me` + employees list return `logout_enabled`.
- **Verified:** testing agent iteration_24 — 12/12 backend (full bind state machine incl. approve/409/reject/reset/owner-bypass + `/me` logout toggle) + web Employees 100% (banner Approve clears row, logout toggle persists, Reset shows only when bound). Mobile typecheck + Android bundle ✅. Backend regression: 22 tests (mobile_phase6 + colleague_gaps) pass.

### "My Colleague" proxy flow + mandatory face enrollment + gap review (8 Aug 2026)
- **Mandatory face enrollment (mobile)**: `/api/auth/me` now returns `face_enrolled`. `EmployeeRoot` shows a strict `FaceEnrollScreen` (front-camera capture → `/api/face/enroll`) before app access whenever an employee has an office assigned but no baseline. Reusable `CameraCapture` component (expo-camera).
- **"My Colleague" tab (mobile `MyColleagueScreen`)**, for employees whose phone is dead/off — used on a colleague's logged-in phone:
  1. **Check me in + selfie**: enter absent employee's email/ID + reason → `POST /api/colleague/checkin` (uses this phone's GPS as location proof, must be inside the absent employee's office; blocked if no face baseline) → starts their session + pending selfie challenge → capture selfie on this phone → `POST /api/colleague/selfie` (face-matched to their baseline).
  2. **Phone-off reason**: enter email/ID + note + optional verified selfie → `POST /api/colleague/gap-reason` → attaches to their latest pending coverage gap for admin review.
  Every proxy action is labelled (`proxy_by`, `source=proxy_checkin`) and surfaced to admins; mismatched selfies flag the session + log a `face_mismatch` security event.
- **Coverage gaps persisted** to a `coverage_gaps` collection (id, from/to, gap_ms, battery, likely_battery_died, status, reason_note, selfie_match, reviewed_by). Gap detection now keys strictly off `last_live_ts_ms` (no false gap on a web-created session's first live fix).
- **Admin gap review** (`routes/gaps.py` + web `GapReviews.jsx` at `/admin/gaps`, nav "GAPS"): list by status, view reason + verified selfie photo, **Approve** (status=approved; re-credits `gap_ms` to an active session's `total_inside_ms`/`remaining_ms`) or **Reject** (status=rejected/absent). Second decision → 409.
- **Verified**: testing agent iteration_23 — 14/14 backend pytest + web Gap Reviews 100% (loads, filter tabs, seeded gap card, Approve moves pending→approved with re-credit, employee token rejected, `/me` face_enrolled). Mobile typecheck + Android bundle (1347 modules incl. expo-camera/battery) ✅. Post-fix regression: 15-min gap still detected ✅.
- **Not testable in-container**: mobile screens + the successful proxy-selfie face-match happy path (needs a real enrolled face + Android). User must confirm on a real APK.

### Coverage-gap detection + battery intent-signal (8 Aug 2026)
- **Problem it solves**: powering the phone fully off (or the OS killing the app) leaves NO fixes to capture an exit — and since we never pause on silence, the dark period was wrongly counted as present. This closes that loophole.
- **Mobile**: added `expo-battery`; every live fix now includes battery level (piggybacks the GPS cycle, near-zero cost). `MobileLocationFix`/queue/bulk all carry `battery`.
- **Backend** (`_apply_location_fix`): on each fix, compares its timestamp to the session's `last_live_ts_ms`. A gap > **10 min** → (1) that span is **excluded from counted work time** (no accrual across the gap, incl. bout time on pause), (2) session **flagged**, (3) a `coverage_gap` log entry records `{from_ms, to_ms, gap_ms, battery_before, battery_after, likely_battery_died}`. Battery-before **< 20%** ⇒ `likely_battery_died` (benign); ≥ 20% ⇒ suspicious/intentional. Constants `COVERAGE_GAP_MS`, `BATTERY_DEAD_THRESHOLD`.
- **Admin console** (`AdminDashboard.jsx` IN/OUT LOG): renders a red `⚠ GAP 12m · <time> · battery 56% · suspicious|likely battery died` row inline with the IN/OUT crossings (`data-testid=inout-gap-{id}-{idx}`).
- **Verified**: curl — a 12-min gap between inside fixes counts only the pre-gap 60s (INSIDE=1.0 min), flags the session, logs the gap with `likely_died=False` at 56% ✅; admin screenshot shows the red GAP row + FLAGGED ✅; mobile typecheck + Android bundle (1343 modules, incl. expo-battery) ✅.
- **Known limitation**: a gap proves "unverifiable," not "definitely absent" — if the employee powered off but stayed inside, that time is still (correctly) not counted while flagged for admin review. iOS background throttling could occasionally produce a benign >10min gap (admin review mitigates).

### Offline-durable live location — Goal 2 fully met (7 Aug 2026)
- **Mobile** — the live-location task now writes every fix into a new SQLite table `mobile_location_fixes` (offlineQueue.ts) BEFORE draining, so movement captured while offline (walked in/out with no internet) is buffered on-device and replayed when connectivity returns. `drainLocationQueue()` bulk-sends pending fixes chronologically via `/api/mobile/location-sync`, marks them synced, and 2-day-purges. Wired into the task itself + AuthContext bootstrap/foreground.
- **Backend** — new `POST /api/mobile/location-sync` (`MobileLocationBulk`) replays fixes oldest-first through `_apply_location_fix`. Added a per-session **idempotency watermark** (`last_live_ts_ms`): any fix at/behind the newest applied one returns `stale_replay` and mutates nothing — so a resent batch (lost-response retry) never double-counts time or bouts.
- **Verified**: bulk replay start→active→pause ✅; replaying the identical batch yields `stale_replay ×3` with `inside_ms` unchanged (true idempotency) ✅; mobile typecheck + Android bundle (1340 modules) ✅; `test_mobile_phase6.py` 8/8 ✅.
- **Goal status now**: G1 (online+asleep) ✅, G2 (offline→sync) ✅, G3 (online+app-open) ✅ — all pending real-APK confirmation.

### WhatsApp-style continuous live location (7 Aug 2026)
- **Root cause of two field bugs**: the app relied on native geofence ENTER/EXIT transitions. Samsung's battery optimizer suppresses these once the phone sleeps in a pocket, so (1) the EXIT never fired → session stayed "active" forever after walking out, and (2) nothing streamed between transitions → the admin map pin never moved (looked like the WebSocket was broken — it wasn't).
- **Mobile — `src/services/liveLocation.ts`**: new Android/iOS foreground-service location task (`gfattend.live`) via `Location.startLocationUpdatesAsync` with a persistent notification ("Attendance tracking active"). Streams a High-accuracy fix every **15s / 25m** with `pausesUpdatesAutomatically:false` so it keeps running with the screen off. Each fix POSTs to `/api/mobile/location`. Wired into `AuthContext` (start on login/bootstrap/foreground, stop on sign-out) and `EmployeeHomeScreen` (start on mount + when bg permission granted). Geofences remain armed as a battery-cheap fast-path.
- **Backend — `POST /api/mobile/location`** (`routes/mobile.py` `_apply_location_fix`): ingests each continuous fix and drives the session state machine server-side on EVERY fix — no session+inside→auto-start, active+definitely-outside→pause, active+inside→accrue time, paused+inside→resume, paused+outside→keep paused but move the pin. Every branch calls `_broadcast_session` so the admin live-map updates in real time. Ticks selfie-challenge lifecycle, respects resume window, writes attendance record on completion/expiry, logs mock-location as a soft security event. New model `MobileLocationFix`. `mobile.postLocation` added to `src/api/mobile.ts`.
- **Verified**: curl state-machine flow (start→active→pause-on-exit→resume) ✅; WebSocket smoke test proved an employee fix instantly pushes a `session.update` with moving `last_fix` to a connected admin ✅; mobile `yarn typecheck` clean ✅; `yarn expo export:embed` Android bundle (1340 modules) ✅. Backend suite: 173 passed / 2 shared-DB contamination flakes (pass in isolation) / 1 skipped.
- **NOTE**: real background behaviour (screen-off streaming, persistent notification, Samsung battery) can only be verified by the user on a real APK/EAS build — the container cannot run Android.


### Live FCM wired (6 Aug 2026)
- Firebase service-account JSON (project `attend-11366`) added to `backend/.env` as `FCM_SERVICE_ACCOUNT_JSON` + `FCM_PROJECT_ID`; `backend/.env` + `frontend/.env` now git-ignored.
- `_fcm_configured()` → True; real OAuth2 token minted against `oauth2.googleapis.com`; real POST to `https://fcm.googleapis.com/v1/projects/attend-11366/messages:send` verified end-to-end (fake device token cleanly returns `fcm_400 INVALID_ARGUMENT`).
- `challenge-now` push moved to FastAPI `BackgroundTasks` — admin API stays snappy (<300ms) regardless of FCM round-trip latency. Deadman cron sweep already runs sends in a BackgroundTask.
- Invalid-token auto-cleanup verified live: sending to a fake push_token → `push_token` set to null + `push_token_invalid_at` timestamped on the `mobile_devices` row.
- Backend tests: 168 passed, 1 skipped (0 regressions).

### Phase 0-6 whole-app audit pass (6 Aug 2026)
- Full serial pytest: **168 passed / 1 skipped / 1 warning** (was 146; testing agent added 22 e2e-ingress tests that hit the public Kubernetes URL).
- Mobile `yarn typecheck` clean.
- Two minor spec deviations flagged by testing agent + fixed in-place:
  1. `GET /api/sessions/live` now enriches with `office_name` (batched N+1-safe fetch alongside users_by_id) — `routes/sessions.py:832-861`.
  2. `POST /api/sessions/challenge-now/{user_id}` returns **409 Conflict** (was 400) when an unresponded selfie challenge is already pending — `routes/sessions.py:867`.
- Per-phase live-ingress pass matrix (from iteration_15.json):
  - Phase 0 (mobile prep) ✅ · Phase 1 (auth dual-mode) ✅ · Phase 2 (BG geofence contract) ✅ · Phase 3 (push+selfie) ✅ · Phase 4 (admin live) ✅ · Phase 5 (employees+reports) ✅ · Phase 6 (attestation+deadman) ✅

### Phase 6 · Reliability polish — anti-spoof + deadman + boot receiver (6 Aug 2026)
- **`POST /api/mobile/attestation`** — records a Play Integrity (Android) / App Attest (iOS) token per device. Structural verification stub for now (JWS 3-segment shape or base64-ish for iOS; anything matching our stub format `stub-<nonce>-...` tagged `stub_accepted`). Malformed payloads log a `high`-severity `attestation_invalid` security_event but never block the request (anti-spoof is soft).
- **Mobile client** — `src/services/attestation.ts` mints a stub token (`stub-<nonce>-<devicePrefix>-<hex24>`) and posts on device register + can be re-invoked before critical events. Auto-called from `AuthContext.registerDeviceQuiet()` right after `/register-device` so every login refreshes the attestation.
- **`POST /api/cron/deadman-tick`** — new cron webhook that every 15 min scans employees whose schedule says they should be at work but whose device hasn't sent a heartbeat / geofence event in `> 20 min` and has no active session. Sends a silent FCM push (background=1, no UI) to wake the app which then reconciles + drains queue. Per-device 30 min cooldown + `cron_runs` idempotency guard so the same `run_id` is never processed twice.
- **`.emergent/crons.yml`** — schedules `deadman-tick` at `*/15 * * * *`. Uses `WEBHOOK_CRON_SECRET` from `backend/.env`, constant-time bearer check, returns 2xx quickly and offloads the sweep to FastAPI `BackgroundTasks` as the scheduled-tasks skill mandates.
- **Android boot receiver** — Expo config plugin at `/app/mobile/plugins/withAndroidBootReceiver.js`. Adds a `<receiver>` for `ACTION_BOOT_COMPLETED / QUICKBOOT_POWERON / (MY_)PACKAGE_REPLACED` to `AndroidManifest.xml`, emits `BootReceiver.kt` under the app package, and boots a headless JS task named `gfattend.boot`. The task (`src/services/bootTask.ts`) runs `coldStartReconcile → syncOfficeGeofence → drainQueue → sendHeartbeat`, re-arming a phone that rebooted overnight. iOS is a no-op — CLCircularRegions survive reboot natively.
- **Backend tests** — `tests/test_mobile_phase6.py` (8 cases): missing device → 404, stub verdict, invalid structure logs security event, JWS shape accepted, cron auth 401 (missing/wrong), duplicate run_id dedup, and end-to-end stale-device silent push proof (plants a stale mobile_device row + verifies `last_deadman_poke_ms` moves).
- **Reliability mitigations delivered** (all 6 from MOBILE_ARCHITECTURE.md):
  1. ✅ Android boot receiver (this phase)
  2. ✅ Cold-start reconciliation (Phase 2)
  3. ✅ Server-side deadman timer (this phase)
  4. ✅ iOS SLC fallback (Phase 2)
  5. ✅ Health chip (Phase 2)
  6. ✅ Admin OFFLINE DEVICE badge (Phase 0)
- **TypeScript** — `yarn typecheck` clean (0 errors).

### Phase 5 · Admin Team + Reports + Offices CRUD (6 Aug 2026)
- **`AdminTeamScreen`** — full mobile CRUD for employees:
  - **Create**: name / email / password (min 8) / office chip-selector; disabled until valid.
  - **Edit**: name + office reassignment; email is read-only (backend blocks changes anyway).
  - **Delete**: confirm alert → soft-delete via `DELETE /api/employees/{id}`.
  - Empty state with call-to-action; office name resolved via join of `offices` query.
  - testIDs: `new-emp-btn`, `emp-row-{id}`, `emp-save`, `emp-delete`, `emp-office-{officeId}`.
- **`AdminReportsScreen`** — real reports view (replaced the P4 placeholder):
  - 6 live-updating summary cards (ACTIVE, PAUSED, EMPLOYEES, OFFICES, TOTAL RECORDS, FLAGGED) from `/api/attendance/summary`.
  - Horizontal filter chips: "Everyone" + one per employee, filters records inline.
  - Recent records list (limit 100) with outcome pill colour (green=completed, red=expired, blue=logout, grey=reset), hours formatted `Xh MMm`, FLAGGED badge inline.
  - Footer note that CSV/PDF export lives on the web dashboard (mobile blob-download deferred to Phase 6 polish).
  - testIDs: `rep-active|paused|employees|offices|total|flagged`, `filter-all`, `filter-emp-{id}`, `record-{id}`.
- **`AdminOfficesScreen`** — upgraded from P4 edit-only to full CRUD:
  - **Create**: name + tap-map-to-place + Use-my-current-location button + radius input; native map with live-updating geofence circle as radius changes.
  - **Edit**: same modal UX; draggable pin lets admin reposition existing offices on-device (parity with the web draggable pin fix from 5 Aug).
  - **Delete**: confirm alert → `DELETE /api/offices/{id}`.
  - `data-testid="new-office-btn"`, `office-row-{id}`, `office-save`, `office-delete`, `use-my-location`.
- **AdminStack** now has 5 tabs: Live · Offices · Team · Reports · Profile.
- **TypeCheck** — `yarn typecheck` clean (0 errors).
- **Backend verified via curl** — `GET /api/attendance/summary` returns the 6 counts; `GET /api/attendance/records` returns the expected employee_name + office_name enriched shape via Bearer token. No backend changes required.

### Phase 4 · Admin live map + core actions (6 Aug 2026)
- **`AdminHomeScreen`** — native `react-native-maps` with:
  - Every office rendered as a **green geofence circle** + green pin marker.
  - Every live employee rendered as a **status-coloured marker** (blue for active, orange for paused).
  - Header stats row: ACTIVE / PAUSED / OFFICES counts (`data-testid="stat-active|paused|offices"`).
  - Per-session action row underneath the map with:
    - **Send selfie now** button (calls `POST /api/sessions/challenge-now/{user_id}` — disabled if a challenge is already pending, testID `send-selfie-{sessionId}`)
    - **End session** button (calls `POST /api/sessions/force-expire/{user_id}` with confirm alert, testID `end-session-{sessionId}`)
  - Pull-to-refresh + 10 s auto-refresh via `react-query`.
  - Status flags rendered inline: STALE, FLAGGED, minutes-remaining.
- **`AdminOfficesScreen`** — offices list with tap-to-edit modal:
  - Native map preview inside the edit modal.
  - Live-updating geofence circle as the admin changes the radius.
  - Bottom tab renamed to include Offices between Live and Team.
  - Refuses radius < 30 m with inline validation ("iOS ignores geofences smaller than 50 m" tip).
- **Backend security hardening**: `/api/auth/mobile-logout` now validates that the JWT `sub` is a well-formed ObjectId before hitting Mongo — a forged token with a non-ObjectId sub would previously 500; now it returns 401 cleanly. Non-blocking finding from iteration_12 report.

### Phase 3 · Push notifications + selfie capture (6 Aug 2026)
- **Push token registration** (`src/services/push.ts`) — requests notification permission, fetches the native FCM/APNs device token via `Notifications.getDevicePushTokenAsync()`, and posts it to `/api/mobile/register-device`. Uses raw platform tokens (not Expo Push) so our own FCM pipeline can talk directly to APNs+FCM.
- **Android notification channel** — `attendance` channel with MAX importance, vibration, lockscreen visibility public.
- **Foreground handler** — `Notifications.setNotificationHandler` so pushes appear as heads-up banners even while the app is open.
- **Challenge subscription** (`subscribeChallenges`) — installs 3 listeners: (1) foreground receive, (2) tap-response, (3) `getLastNotificationResponseAsync` for "app opened by push while killed". All converge on the same `open()` callback.
- **ChallengeContext** (`src/context/ChallengeContext.tsx`) — global store for "the user has a pending selfie challenge". Three trigger paths converge here:
  1. FCM push data payload (primary)
  2. `/api/sessions/me` foreground poll every 12 s (safety net when FCM_SERVICE_ACCOUNT_JSON is not yet configured)
  3. Programmatic `open()` (debug / future admin push-through)
  Deduplicates by `challenge_id` so a push + poll for the same challenge only opens the modal once.
- **ChallengeModal** (`src/components/ChallengeModal.tsx`) — full-screen `expo-camera` front-facing capture with a live countdown to `respond_by_ms` (turns red under 60 s), auto-requests camera permission on first open, uploads base64 image to `/api/sessions/challenge/{id}/respond` where the existing server-side dlib matcher verifies against the face baseline. Emits alert on success/failure and invalidates `["my-session"]` + `["mobile-reconcile"]` so the Home screen updates instantly.
- **App wiring** — `App.tsx` now nests `<ChallengeProvider>` between Auth and Navigation, and mounts `<ChallengeModal>` above the navigator so it can overlay any screen (Employee tabs, Admin tabs, or during transitions).

### Phase 2 · Background geofencing + offline queue (6 Aug 2026)
- **Native geofencing** via `expo-location` — `TaskManager.defineTask('gfattend.geofence')` receives OS-level enter/exit transitions even when the app is killed. Fetches a fresh GPS fix on wake so lat/lng/accuracy reflect actual position, not just the region center.
- **iOS SLC fallback** — arms `startLocationUpdatesAsync('gfattend.slc')` with a 500 m distance interval alongside the geofence, so we still get a signal if force-quit degrades geofencing.
- **Offline queue** (`src/services/offlineQueue.ts`) — SQLite table `mobile_events` with UNIQUE(client_event_id), attempts counter, last error message, and a 7-day purge on synced rows.
- **Sync worker** (`src/services/syncWorker.ts`) — drains the queue via `/api/mobile/sync` (bulk). Server-side idempotency + client_event_id UNIQUE index make retries safe.
- **Cold-start reconciliation** (`src/services/reconcile.ts`) — every app open: drain queue → fetch server state → refresh geofence registration → foreground GPS fix → if inside geofence but server has no session, synthesize a `cold_start_reconcile` enter event. Heals Android-reboot-at-office + iOS force-quit-at-office scenarios.
- **Health chip** (`src/components/HealthChip.tsx`) — green/amber/red pill on Employee Home showing permission state, queue depth, geofence-armed state; tap to reactivate.
- **Onboarding gate** (`src/screens/onboarding/PermissionsScreen.tsx` + `EmployeeRoot.tsx`) — three-step permission flow (foreground → background → notifications) with per-step status badges and Open-Settings escape hatch.
- **Auth-side effects** — after employee login: coldStartReconcile → startHealthLoop (5-min heartbeats via `/api/mobile/heartbeat`) → purgeOldSynced. Sign-out stops geofencing + health loop and calls the new `/api/auth/mobile-logout`.
- **New backend endpoint**: `POST /api/auth/mobile-logout` — accepts `{refresh_token}` in body, revokes it, and ends any active session. Uses no auth dependency so a mobile client with an expired access token can still sign out cleanly.
- **Reliability mitigations delivered** (from the Transistor-replacement plan):
  1. ✅ Cold-start reconciliation
  2. ✅ Health chip (self-service reactivate)
  3. ✅ iOS significant-location-change fallback
  4. ✅ Server-side stale detection (already in Phase 0)
  5. ⏳ Boot receiver (Android config plugin) — deferred to Phase 6 polish
  6. ⏳ Server-side deadman timer — deferred to Phase 6 polish
- **TypeScript** — `yarn typecheck` passes clean (0 errors).

### Phase 1 · Mobile app shell (6 Aug 2026)
- **New project** at `/app/mobile` — React Native + Expo SDK 52, TypeScript strict, no expo-router (manual React Navigation for explicit role routing).
- **Providers pyramid** in `App.tsx`: GestureHandler → SafeArea → ReactQuery → Auth → NavigationContainer.
- **Auth**: `AuthContext` bootstraps from SecureStore-persisted JWT on cold start, calls `/api/auth/me` to hydrate the role, and idempotently posts `/api/mobile/register-device` after login (device id from `Application.getIosIdForVendorAsync` / `getAndroidId`, tz + locale from `expo-localization`).
- **Role routing**: `RootNavigator` swaps between `AuthStack` (Login → ForgotPassword) and either `EmployeeStack` (Home / History / Profile tabs) or `AdminStack` (LiveMap / Team / Reports / Profile tabs) based on `user.role`.
- **API client** (`src/api/client.ts`) — axios with Bearer-token interceptor, 401→refresh→retry loop, base URL read from `app.json → extra.apiUrl` so EAS dev/preview/production can point at different backends.
- **Backend auth changes for mobile compatibility** (fully backwards-compatible with the web dashboard):
  - `/auth/login`, `/auth/register-org`: response body now includes `access_token`, `refresh_token`, `token_type` alongside the user profile. Web app still ignores them and reads cookies as before.
  - `/auth/refresh`, `/auth/logout`: accept `refresh_token` in JSON body (mobile) OR from `httpOnly` cookie (web).
  - `/auth/refresh` returns rotated `access_token` + `refresh_token` in body so mobile can persist them.
- **Screens delivered (P1 placeholders that already talk to real endpoints)**:
  - Login (email + password, single form used by both roles) with inline error banner (`data-testid="login-error"`).
  - Forgot Password.
  - Employee Home: pulls `/api/mobile/reconcile` and shows assigned office + current session status card.
  - Employee History / Profile — placeholder + sign-out.
  - Admin Home: pulls `/api/sessions/live` and shows live sessions list.
  - Admin Team: pulls `/api/employees`.
  - Admin Reports / Profile.
- **Theme** — dark near-black + green (#10b981) accents, mirrors web design tokens.
- **Reusable components** — `Button`, `Input`, `Screen` (safe-area wrapper).
- **Build & test config** — `eas.json` with dev/preview/production profiles, `tsconfig.json` strict, `babel.config.js` with module-resolver `@/*` alias. Passes `yarn typecheck` with 0 errors.
- **Testing** — Phase 1 verified end-to-end via curl: login returns tokens in body, `/auth/refresh` with body works, Bearer auth on `/api/mobile/reconcile` succeeds, `/auth/logout` accepts body refresh token, rotated refresh invalidates old token, web-cookie flow still 100% functional (regression-tested).

### Phase 0 · Mobile backend prep (6 Aug 2026)
- **New collections**: `mobile_devices` (unique on `user_id+device_id`), `mobile_events` (unique on `user_id+client_event_id` for offline-safe idempotency).
- **New endpoints** (all under `/api/mobile`):
  - `POST /register-device` — upsert per user+device with push token, tz, app version.
  - `DELETE /register-device/{device_id}` — soft-delete + wipes push_token.
  - `GET  /devices` — self service list.
  - `POST /geofence-event` — single enter/exit/cold_start_reconcile with `client_event_id` dedup.
  - `POST /sync` — bulk drain of offline queue; events replayed in chronological order.
  - `POST /heartbeat` — device health for the OFFLINE DEVICE admin badge.
  - `GET  /reconcile` — one-shot state snapshot for cold-start app open.
- **Mobile event → state machine bridge**: `enter` events auto-start using `event.ts_ms` as effective start (fixes indoor-notification-delay drift). `exit` pauses; `cold_start_reconcile` heals mismatched state. All events go through the same `_sync_session_center_from_office` guard so admin office edits propagate instantly.
- **FCM push service** (`services/push.py`) — OAuth2 v1 API, `send_push_to_user()` fan-out per user. Graceful stub when `FCM_SERVICE_ACCOUNT_JSON` env is missing so Phase 0 works without creds.
- **Push triggers wired**: selfie challenge promotion (`_tick_challenge_lifecycle`) and admin manual `challenge-now` both fan out an FCM notification with `kind=selfie_challenge` + `challenge_id` payload.
- **Soft anti-spoof**: `mock_location: true` payloads log a `security_events` row (severity `high`) but the session still starts — flag, don't block.

### Backend
- **[5 Aug 2026 · bugfix]** Session `center` (coords + radius) is now re-synced from the office record on every `/ping`, `/me`, and `/live` call. Previously the session snapshotted the office radius at start time — so if the admin later shrank the geofence (e.g. 700m → 70m), the session kept using the stale 700m and an employee 660m away stayed "active". Regression test: `test_admin_shrinking_office_pauses_active_session`.
- **[5 Aug 2026 · bugfix]** Low-accuracy pings that are unambiguously outside the geofence (distance > radius + accuracy) now pause the session. Previously any ping with `accuracy > tolerance` skipped the spatial check entirely — allowing a laptop with fuzzy WiFi geoloc to stay "at office" from anywhere in the city. Regression test in `test_bugfixes_5aug.py::test_low_accuracy_ping_far_outside_still_pauses`.
- **[5 Aug 2026 · bugfix]** Session `center` is now always the **admin office coordinates** (was: the employee's GPS at check-in). This means:
  1. The "inside geofence" check on `/ping` uses the true office boundary, so an employee can no longer drift the boundary by starting near an edge.
  2. The frontend no longer draws a phantom offset circle around the employee's start position.
  3. Any active session at deploy time was one-shot migrated to the office center.
- FastAPI with `/api` prefix, MongoDB (Motor), 2dsphere geo index, TTL index on pings
- Auth: register-org, login, refresh (rotating), logout, me, forgot-password, reset-password (Resend email via Emergent proxy)
  - **[5 Aug 2026]** `/logout` now ends any active session for the user (outcome=`logout`) so admins no longer see ghost active sessions after log-out
- Offices CRUD + `admin_audit_log`
- Employees CRUD + reassign flow
  - **[5 Aug 2026]** create-employee returns **HTTP 409** with a specific reason (same-org duplicate / soft-deleted / other-org duplicate / role clash); structured logging on every attempt (`employee_create_attempt|conflict|invalid_office|ok|error`)
- Sessions: `/start`, `/ping`, `/reset`, `/me`, `/live`, `/force-expire/{user_id}`, `/auto-start`, `/challenge/{id}/respond`
  - **[5 Aug 2026]** `/me` and `/live` now tick challenge lifecycle so `planned→pending` promotion happens even without pings (fixes: selfie challenges never delivered when GPS/pings stall)
  - **[5 Aug 2026]** Stale-session detection on every `/me` / `/live` call: active + no ping for 3 min → paused; paused past `resume_window_hours` → auto-expired + attendance record written (fixes: ghost active sessions when employee closes tab)
  - **[5 Aug 2026]** New admin endpoint `POST /api/sessions/challenge-now/{user_id}` — on-demand selfie challenge, refuses if one is already pending, audit-logged
- Settings: on selfie_* changes, remaining `planned` challenges in every active session are re-planned so newly configured fixed times take effect immediately
- Attendance: `/records`, `/export.csv`, `/export.pdf` (reportlab), `/summary`
- Audit log + security events (admin views)
- Org settings (session duration, resume window, accuracy tolerance, max speed, spoof sensitivity, notifications, selfie config)
- Anti-spoof engine: accuracy > tolerance rejects/flags, impossible-speed flags + optional owner email alert
- Server-side face recognition (dlib + face_recognition) with 128-D embedding matcher, baseline enrollment endpoint
- Immutable hash-chained attendance records
- Rate-limit-style login attempt tracking with 15-min lockout
- Startup seed: `akmaljn7@gmail.com` owner + demo office + sample employee

### Frontend
- **[5 Aug 2026]** Face-enrollment nudge banner on Employee Console for unenrolled users, with 24h dismiss + auto-escalation (red) when a selfie challenge is live; deep-links to `/profile` for one-tap enrollment.
- React 19 + CRA, Tailwind, Shadcn UI, React Query, sonner toasts
- react-leaflet with Esri World Imagery satellite tiles
- Pages: Login, Register Org, Forgot/Reset Password, Admin Dashboard, Offices Manage, Employees Manage, Employee Console, Attendance History, Reports, Audit Log, Security Events, Org Settings, Employee Profile, Time Off
- Auth via httpOnly cookies + auto-refresh interceptor
- Live pins with CSS-only pulsing animation, status semantics (green/amber/blue/red)
- PWA manifest + service worker + install-ready icons
- **[5 Aug 2026]** Offices Manage — the geofence-center pin is now **draggable** for precise placement. Solves the WiFi-geoloc-off-by-100m problem. Live coord readout under the map updates as you drag, click-anywhere-on-map still works as a coarse pointer.
- **[5 Aug 2026]** Admin dashboard live rows now expose **Send selfie now** + **End session** buttons and a **STALE · NO PINGS** badge
- **[5 Aug 2026]** Employees form shows an inline red banner (in addition to toast) when create fails, so the reason cannot be missed

## Deferred / Backlog (P0/P1/P2)
- **P0** — Wire actual FCM Credentials (Firebase service-account JSON → set FCM_SERVICE_ACCOUNT_JSON env; flips push/deadman from stub to live)
- **P0** — Mobile Phase 7: Real-device testing on iOS + Android (TestFlight + Play Internal)
- **P0** — Mobile Phase 8: Store submissions prep (privacy policy, `privacyManifest`, app.json cleanup)
- **P0** — Bulk CSV employee import
- **P1** — Swap Phase 6 attestation stub → real Play Integrity + App Attest (add `expo-play-integrity` + native iOS bindings)
- **P1** — APScheduler background jobs (90-day GPS TTL cleanup, refresh-token cleanup, session expiry sweeps as a defence-in-depth backup to inline ticks)
- **P1** — Email invite for new employees with set-password link
- **P1** — Device fingerprint + IP-geo cross-check anti-spoof
- **P1** — SSO (Google/Microsoft) via Emergent Google Auth
- **P2** — GDPR data-export + hard-delete endpoints (right-to-be-forgotten)
- **P2** — Wire Resend triggers for face_mismatch / spoof_flag / selfie_missed security events
- **P2** — Stripe billing per org
- **P2** — i18n
- **P2** — Landing / marketing page

## Test Credentials
See `/app/memory/test_credentials.md`
