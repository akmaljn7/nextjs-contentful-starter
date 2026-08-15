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
### GPS jitter false IN/OUT — robust hysteresis fix (June 2026)
- **Root cause**: the live path had only an impossible-speed filter (>55 m/s). At the 15 s cadence that only rejects >825 m teleports; the common 100–800 m jitter blip (phone on desk) has low implied speed, passed the filter, and — since the exit debounce had been removed — a single stray fix `definitely_outside` **paused the session instantly**, logging a false OUT then IN.
- **Fix (`routes/mobile.py` `_apply_location_fix`)**: added **crossing hysteresis** — a boundary crossing is only committed once SUSTAINED across `EXIT_CONFIRM_FIXES=3` fixes AND `EXIT_CONFIRM_MS=45s` (enter: `2` fixes / `20s`). During the uncertain hold the session stays put, no inside time is accrued, and if the fix comes back before confirmation it's recorded as a non-crossing `jitter_ignored` breadcrumb (never an OUT/IN). A confirmed exit is **backdated to the first outside fix**. Added **accuracy gating** (low-confidence fixes can't trigger a crossing) and kept the impossible-speed teleport reject. Pending state stored on the session (`pending_exit_since_ms/count`, `pending_enter_since_ms/count`).
- **Also fixed a regression**: the `@router.post("/start")` decorator on `start_session` had been accidentally dropped during the earlier `/challenge/{id}/timeout` edit — `/api/sessions/start` was 404. Restored.
- **Session-cutoff grace**: added `CUTOFF_GRACE_MS=10s` so a genuine re-check-in right after an admin end/reassign isn't dropped as stale (only meaningfully-older queued events are).
- **Verified**: full backend suite **237 passed / 1 skipped**. New/updated tests: `test_gps_jitter_suppression.py` (blip out-and-back logs nothing; sustained exit commits backdated; enter confirmation; teleport reject), `test_inside_time_double_count_fix.py` (no double-count under hysteresis + offline batch), `test_mobile_phase0.py` aligned.
- **Note**: the raw map dot can still briefly show GPS noise (we don't fabricate positions), but no false IN/OUT is logged.


### Office name in in/out log + stale-event isolation on end/reassign (June 2026)
- **#1 Office name in the admin IN/OUT log**: each crossing (and coverage-gap) row on the LIVE SESSIONS roster now shows `@ {office name}` in front (sky-blue), resolved from an `officeById` map of `/offices` keyed on the session's `office_id`. Test id `inout-office-{sid}-{idx}`.
- **#2 Stale pending events no longer pollute a new session**: added a per-user `session_cutoff_ms` watermark.
  - `POST /sessions/force-expire/{id}` and employee **office reassignment** (`PATCH /employees/{id}` with a changed `office_id`) now: write the immutable attendance record for the current session, delete the live session, and stamp `session_cutoff_ms = now` on the user. Office reassignment closes the old-office session with outcome `office_reassigned`.
  - Mobile ingest (`_apply_geofence_event` and `_apply_location_fix`) drops any event/fix whose client `ts_ms <= session_cutoff_ms` → returns `stale_pre_cutoff` instead of auto-starting/mutating a session. So queued/offline events from before the admin action stay with the already-written attendance record and never spin up or contaminate a fresh session.
- **Verified via curl+DB**: pre-cutoff enter → `stale_pre_cutoff` (no session); post-cutoff enter → `session_started`; force-expire stamps cutoff + writes `force_expired` record; office reassign closes session (count 0), updates office, stamps cutoff, writes `office_reassigned` record. Frontend compiled clean. (Attendance records are hash-chained/immutable, so stale events are dropped from live rather than appended.)


### Employee live on-site clock + offline note (June 2026)
- **Employee mobile HomeScreen** now shows an "ON-SITE TODAY" live `HH:MM:SS` clock (`employee-inside-clock`) that ticks every second while active, mirroring the admin roster's INSIDE counter — same freeze-on-gap logic (`LIVE_FRESH_MS = 60s`, clock-skew corrected via reconcile `server_ts_ms`/`dataUpdatedAt`).
- **Offline/paused note**: while counting → green "Counting live"; active but no fix for >60s → amber `employee-offline-note` "You're offline — your on-site timer is paused and will continue when you're back online."; status paused (walked out) → `employee-paused-note`.
- **Backend**: `/api/mobile/reconcile` `session` view now includes `total_inside_ms` and `last_fix_ts_ms` (needed by the mobile clock). Verified via curl. This backend change is live on preview; the mobile UI change ships in the next APK build.


### "OPEN CAMERA" opened the app but not the selfie camera (FIXED, June 2026)
- **Symptom**: tapping OPEN CAMERA on the full-screen selfie call opened the app but showed no camera.
- **Root cause**: the selfie push is DATA-ONLY (handled by the native `SelfieMessagingService`), so the JS layer never learns about the challenge from the push. The deep link (`geofenceattendance://selfie`) only set `cameraRequested`, but the modal renders/opens the camera only when a challenge (`active`) exists — and `active` was populated solely by the 12 s `/sessions/me` poll, which usually hadn't run yet on open → nothing to attach the camera to.
- **Fix (`ChallengeContext.tsx`)**: on the `selfie` deep link, immediately `GET /sessions/me` and, if there's an `active_challenge`, call `open()` right away (in addition to setting `cameraRequested`). The modal then jumps straight to the 2-step liveness camera. Poll remains as a safety net. Requires a NEW APK build (mobile JS change).


### Push never delivered — FCM token wiped on every refresh (FIXED, June 2026)
- **Symptom**: admin "Send selfie now" and "Notify" reported sent but nothing arrived on the phone.
- **Root cause**: `POST /api/mobile/register-device` unconditionally `$set` `push_token` from the payload. The app calls this endpoint both WITH a token (`registerForPushAsync`) and WITHOUT one (`registerDeviceQuiet`, which runs on every login AND every app-foreground). The token-less calls overwrote the real FCM token with `null`, so **every `mobile_devices` row had `push_token=null`** → `send_push_to_user` (which filters `push_token != null`) had zero recipients → silent no-op.
- **Fix (backend `routes/mobile.py`)**: only write `push_token` when the client actually supplies one (via `$set`); token-less refreshes preserve the existing token; a fresh valid token also clears `push_token_invalid_at`. Verified via curl: register-with-token → token-less refresh → token persists.
- **Fix (mobile `ChallengeContext.tsx`)**: also re-acquire + re-post the FCM token on app-foreground (safe now that the backend preserves it).
- **Note**: APK points at the same preview backend, so the backend fix is already live — the employee must reopen the app once (and grant notification permission) to capture a fresh token, which now persists.


### Auto-timeout + missed-selfie flag + active liveness (June 2026)
- **Auto-timeout (mark missed)**: new `POST /api/sessions/challenge/{id}/timeout` — the mobile `ChallengeModal` calls it the moment its countdown hits 0 so the challenge is finalized as `expired`/ignored immediately (flags session + logs a high-severity `selfie_missed` security event), instead of waiting for the next server tick. The server tick (`_tick_challenge_lifecycle`) now ALSO logs that security event on window expiry. The mobile modal shows a "SELFIE MISSED" screen then auto-dismisses; the native Android full-screen `IncomingSelfieActivity` auto-finishes + stops the alarm when `respond_by_ms` elapses (`respond_by_ms` passed through the FCM data + activity extra).
- **Missed-selfie flag (web roster)**: `_sanitize_session` now returns `missed_selfie` / `missed_selfie_kind` ("ignored"=timed out, "failed"=5 attempts exhausted) / `missed_selfie_count`. Admin dashboard live roster renders a red pulsing badge `⚠ IGNORED SELFIE CALL` / `⚠ FAILED SELFIE CHECK` (`data-testid=live-missed-selfie-{sid}`).
- **Active liveness (2-frame blink/turn)**: new `services/active_liveness.py` — a NEUTRAL frame + an ACTION frame (random `blink`/`turn_left`/`turn_right`, assigned per challenge). Uses dlib 68-pt landmarks to verify a real Eye-Aspect-Ratio drop (blink) or head yaw change (turn) AND that the action frame is the same enrolled person. Defeats printed-photo / static-screen spoofs. Enforced when org `active_liveness` (default True) AND env `ACTIVE_LIVENESS_ENFORCE` (default true). `respond_challenge` runs match-first then the liveness gate; a failed liveness shares the same 5-attempt cap as a mismatch (`_register_selfie_failure`). Missing liveness frames when enforced → 400 (does NOT burn an attempt). Mobile `ChallengeModal` is now a 2-step guided capture. Known limit: a pre-recorded video replay can still blink (full defeat needs a paid certified SDK).
- **Verified**: testing agent iteration_28 — 38/38 backend (iter28 HTTP + `test_active_liveness_unit.py` pure-logic + iter27 + face_match regressions) and the web missed-selfie badge visible with the correct data-testid. ⚠️ Mobile 2-step camera, auto-timeout screen, and native full-screen auto-dismiss need real-APK confirmation.


### Selfie mismatch 5-retry limit — FIXED (June 2026)
- **Bug**: a single mismatched selfie permanently locked the challenge ("Challenge is already mismatch"). Root cause: `respond_challenge` set `ch["status"]="mismatch"` on the first failure; the `MAX_SELFIE_ATTEMPTS=5` constant existed but the retry logic was never wired.
- **Fix**: new `_register_selfie_failure()` helper in `routes/sessions.py` — increments `ch["attempts"]`, keeps `status="pending"` (challenge stays OPEN, employee can retake) until the 5th failure, then flips to `status="missed"`, flags the session, and logs a high-severity security event. Applies to both face-mismatch and liveness branches. Non-terminal failures return 403 "Attempt X of 5 — N left"; the 5-min response window still overrides (expiry → "expired" regardless of attempts). Per-attempt security events: `medium` for retries, `high` for the terminal failure.
- **Verified**: testing agent iteration_27 — 6/6 new tests (`test_selfie_retry_iter27.py`) enroll a real baseline and drive mismatch/match/window-expiry flows; obsolete assertion in `test_face_match.py::test_challenge_mismatch_flags_and_logs` updated to new semantics. Full run: 17/17 pass.


### WhatsApp-style full-screen incoming selfie (Android) (June 2026)
- **Goal**: a selfie request should wake a sleeping/locked phone and show a full-screen "Selfie for {name}" page OVER the lock screen, ringing, with a single "OPEN CAMERA" button (no accept/decline) — exactly like a WhatsApp incoming call. Android-only (iOS keeps the loud high-priority alert).
- **How**: new Expo config plugin `plugins/withSelfieFullScreen.js` injects native Android — `SelfieMessagingService.kt` (extends `ExpoFirebaseMessagingService`; on a `kind=selfie_challenge, full_screen=true` push it builds a `CATEGORY_CALL` notification with `setFullScreenIntent(...)`, delegates all other pushes to Expo) and `IncomingSelfieActivity.kt` (`showWhenLocked`+`turnScreenOn`, loud looping `res/raw/selfie_alert` + vibration, "OPEN CAMERA" deep-links `geofenceattendance://selfie`). Manifest: adds `USE_FULL_SCREEN_INTENT`, removes Expo's FCM service (so ours receives), registers our service+activity. Plugin also copies the alarm tone into `res/raw`.
- **Backend**: selfie pushes now sent **data-only on Android** (`full_screen=True` in `send_push`) so the native service fires even when the app is killed/asleep; iOS still gets `aps.alert`+custom sound. High priority + the earlier battery-opt exemption ensure prompt Doze delivery.
- **RN**: `ChallengeContext` listens for the `geofenceattendance://selfie` deep link and sets `cameraRequested`; `ChallengeModal` skips its in-app ring screen and jumps straight to the camera when launched that way. Android-14 `USE_FULL_SCREEN_INTENT` special-access prompt added (`requestFullScreenIntentAccess`) alongside the battery prompt.
- **Verified**: `expo prebuild` patches manifest (permission, service removal/registration, `showWhenLocked` activity), writes both Kotlin files, bundles `res/raw/selfie_alert.wav`; `yarn typecheck` clean; Android JS bundle builds. ⚠️ Full behavior only testable on a rebuilt APK.

### Selfie "network error" fix + loud selfie alarm; liveness infra (June 2026)
- **Selfie network error — FIXED (root cause)**: `verify_face` (dlib `face_locations`+`face_encodings`) ran SYNCHRONOUSLY inside the async event loop, blocking it; with live streaming + polling in flight, the selfie `respond` exceeded the mobile 15s timeout → axios "Network Error" (NOT the payload). Now all face work is offloaded via `asyncio.to_thread` (new `face_match.analyze` does one detection → match + liveness). Applied to `respond_challenge`, colleague `selfie`/`checkout`/`gap-reason`, and `face/enroll`. Verified: match→200 in 0.54s, mismatch→403 in 0.30s.
- **Liveness (MiniFASNet) — infra built, gate OFF**: added `onnxruntime` + `services/liveness.py` (MiniFASNet scorer: 1.5x crop → letterbox 128 → BGR → softmax, idx1=real) and wired a gate into every selfie path (`LIVENESS_ENFORCE`, `LIVENESS_THRESHOLD`). BUT the free ONNX models tested (hairymax `bin` + `print-replay`) SATURATE — they classify all inputs the same across 8+ preprocessing variants, so enforcing would lock out real staff. Gate left OFF (`LIVENESS_ENFORCE=false`, models removed). NOT "100% accurate" — pending a validated model or an active blink/turn challenge (recommended free alternative) / AWS certified (paid).
- **Loud selfie alarm — FIXED timing + sleeping-phone ring**: two-phase `ChallengeModal` — an "incoming" ring screen (looping `expo-av` tone + repeating vibration) shows FIRST when the request arrives and STOPS when the user taps "Open camera" (previously it only rang at the camera). New MAX-importance `selfie_ring` Android channel with a bundled 26s alarm tone (`assets/selfie_alert.wav` via expo-notifications `sounds` plugin) + `bypassDnd`; backend sends selfie pushes on that channel with the custom sound so a sleeping/locked phone rings loudly.
- **Verified**: backend curl (threaded match/mismatch timing, checkout guards), mobile typecheck clean, Android bundle builds (1382 modules). ⚠️ Alarm sound/vibration + liveness need real-APK confirmation.

### Proxy check-OUT + loud selfie alarm (June 2026)
- **Proxy check-out (#1)**: new `POST /api/colleague/checkout` (`ColleagueCheckout` model) ends an absent colleague's active session from a lending phone — requires a selfie matching their baseline (mismatch → 403 + `face_mismatch` security event), writes the attendance record, deletes the session, broadcasts ended, returns time-on-shift. New "Check out" tab in `MyColleagueScreen` (email → selfie → done). Guard paths verified via curl (400 no-baseline, 404 no-session).
- **Loud selfie alarm (#2)**: backgrounded pushes already ring via the MAX-importance "attendance" channel (sound + vibration). Added an in-app alarm for when the employee is working inside the app (data-poll opens the modal with no OS sound): `services/alarm.ts` loops a loud tone (`assets/selfie_alert.wav`, via `expo-av`) + a repeating vibration, wired into `ChallengeModal` (starts on open, stops on capture/dismiss/expiry).
- **Verified**: backend curl (checkout guards), mobile `yarn typecheck` clean, Android bundle builds (1382 modules incl. `expo-av` + alarm asset). ⚠️ Audio/vibration/camera + checkout need real-APK confirmation.

### "My Colleague" proxy + selfie fixes — 7-issue batch (June 2026)
- **#1 Double check-in blocked**: `POST /api/colleague/checkin` now returns 409 "already checked in" (or "paused") if the target already has a session, so the app shows the message instead of opening the camera. Proxy check-in always creates a fresh, labelled session.
- **#2 On-shift (no change needed)**: confirmed both proxy and automatic check-in already deny off-shift for weekly-schedule employees via `_compute_schedule_duration_ms`; "any"/"fixed-hours" employees stay free anytime (per user's intent).
- **#3 + #4 Phone-off reason photos**: removed "submit without selfie" — selfie now mandatory; added an OPTIONAL phone-evidence photo (single flow: selfie → "Add phone photo / Skip & submit"). New `evidence_photo` on `ColleagueGapReason`, saved under `gap-evidence::{id}`, new `GET /api/gaps/{id}/evidence`, `has_evidence_photo` in list; web GapReviews shows both "View selfie" + "View phone photo". `CameraCapture` got a `facing` prop (rear for the phone shot). Verified e2e via curl + screenshot.
- **#5 Named selfie prompt**: push notification and `ChallengeModal` now say "This selfie is for {name}" (name added to `_tick_challenge_lifecycle` + `challenge-now` push body/data, `for_name` in `active_challenge`, carried through push.ts/ChallengeContext).
- **#6 Selfie "network error" fixed**: `ChallengeModal` now downscales to 512px + compresses before upload (same oversized-payload bug as onboarding).
- **#7 Proxy labelling surfaced**: `_sanitize_session`/`/live` now return `source`/`proxy_by`/`proxy_reason`; admin console shows an amber "PROXY · BY {email}" badge (screenshot verified).
- **Verified in-container**: backend curl e2e (evidence flow, 200s), web screenshots (PROXY badge, evidence photo), mobile `yarn typecheck` clean + Android bundle (1365 modules). ⚠️ Mobile-side (#1/#4/#5/#6 UI) needs real-APK confirmation.

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

- **[11 Jun 2026]** BUG FIX — Mobile app crashed instantly after **admin** sign-in. Root cause: `AdminHomeScreen`/`OfficesScreen` render `react-native-maps` (Google Maps on Android via `PROVIDER_DEFAULT`), but `app.json` had **no** Google Maps API key, so the Google Maps SDK crashed the app the moment the map mounted. Employee screens have no map → never crashed. Fix: added `android.config.googleMaps.apiKey` to `app.json`; verified via `expo prebuild` that `com.google.android.geo.API_KEY` meta-data is now injected into AndroidManifest. **Requires APK rebuild to take effect.** Note: for the live map tiles to render (vs blank map) the key's Google Cloud project must have "Maps SDK for Android" enabled — if not enabled the map is blank but the app no longer crashes.

- **[11 Jun 2026]** MOBILE — Automatic blink selfie (no capture button). `ChallengeModal.tsx` rewritten: once the camera opens the flow is hands-free — settles, auto-captures a neutral (eyes-open) frame, prompts "gently close your eyes and hold", auto-captures the blink frame, and uploads both to `/sessions/challenge/{id}/respond` with `liveness_action="blink"`. Auto-retries up to 5 times on a failed match/liveness. Shutter button removed. Backend `LIVENESS_ACTIONS` set to `["blink"]` so every challenge is blink-only. Backend regression green (iteration_29). **Requires APK rebuild.**
- **[11 Jun 2026]** MOBILE — Never auto-logout an employee. Root cause: `AuthContext.bootstrap()` wiped tokens + set user=null on ANY error (incl. network errors when data/location is off), and the axios interceptor (`client.ts`) cleared tokens on a failed refresh. Fix: bootstrap now falls back to a SecureStore-cached last-known profile (`cached_user`) when `/auth/me` fails, staying signed in offline; the interceptor no longer wipes tokens on refresh failure. Tokens/session are only cleared on an explicit Sign out (employee Sign out still gated by `logout_enabled`). Auth/refresh backend flow verified intact (iteration_29). **Requires APK rebuild.**

- **[11 Jun 2026]** MOBILE — Real on-device face + blink detection before capture. The earlier timer-based auto-capture would snap even at a wall. Added `@infinitered/react-native-mlkit-face-detection@3.0.0` + `@infinitered/react-native-mlkit-core@3.0.0` + `expo-image@2.0.7` (all pinned to Expo SDK 52 / RN 0.76; v5 targets SDK 54 — do NOT bump). New shared `mobile/src/components/LivenessCamera.tsx` uses `expo-camera` preview + ML Kit (`useFaceDetection().detectFaces(uri)`, `classificationMode:true`) to (1) show face detected / not detected, (2) require a real blink (leftEye/rightEyeOpenProbability open→closed) to auto-capture the neutral + blink frames, (3) upload for server dlib match → Verifying → Verified / Face didn't match (auto re-arms on failure). Wired into `ChallengeModal.tsx` (selfie challenge), `FaceEnrollScreen.tsx` (first-time login selfie AND admin-reset re-enroll — same logic), and `FaceDetectionProvider` added in `App.tsx`. Backend unchanged (still blink-only, 2-frame respond). Verified: tsc pass, Metro bundles all modules, expo autolinking resolves modules, prebuild OK. NOT device-tested (requires physical camera). **Requires APK rebuild.**

- **[11 Jun 2026]** MOBILE — Replaced the still-capture blink approach with a REAL-TIME frame processor. Real-device feedback: the ML Kit-on-`takePictureAsync` loop caused a repeated shutter sound ("ka-chak") and only sampled eyes ~1/sec so blinks were missed (had to blink 10-15×). Root cause: `expo-camera` can't disable the Android shutter sound and can't stream frames. Fix: switched `LivenessCamera.tsx` to `react-native-vision-camera@4.6.4` + `react-native-vision-camera-face-detector@1.8.9` (wrapper `<Camera faceDetectionCallback>`) + `react-native-worklets-core@1.6.2` — pinned for Expo SDK 52 / RN 0.76 / reanimated 3.16 (NOT the nitro 2.x / v5 lines). The face detector reads the live preview at high fps (no photos → no shutter spam), detects a full open→closed→open blink instantly, then takes ONE silent photo (`takePhoto({enableShutterSound:false})`). Removed `@infinitered/react-native-mlkit-*` + `expo-image`. babel.config.js: added `react-native-worklets-core/plugin` (before reanimated). app.json: added `react-native-vision-camera` config plugin. Backend: `ChallengeResponse` gained `client_liveness` — when true (on-device liveness proven) the server accepts a single frame and runs face-match + passive liveness, skipping the 2-frame active-liveness requirement (legacy 2-frame path preserved). Same flow now used by the selfie challenge, first-time enroll, and re-enroll. Verified: tsc pass, Metro bundles 1435 modules (worklets babel transform OK), prebuild applies the config plugin (CAMERA perm + Maps key intact), autolinking resolves vision-camera, backend `client_liveness` parses (404 not 500). NOT device-tested — needs a physical camera. **Requires APK rebuild.**

- **[12 Jun 2026]** MOBILE BUILD FIX — EAS Android build failed at `:app:processReleaseMainManifest` with "minSdkVersion 24 cannot be smaller than version 26 declared in library [:react-native-vision-camera-face-detector]". The face-detector requires Android minSdk 26; the app was 24. Fix: bumped `minSdkVersion` 24→26 in the `expo-build-properties` plugin in `app.json` (Android 8.0+, ~99% device coverage). Verified via `expo prebuild` that `android.minSdkVersion=26` is now in the resolved `gradle.properties`. Just re-run `eas build`.

- **[13 Jun 2026]** MOBILE CRASH FIX (log-confirmed) — camera crashed instantly on mount with `Error: Requiring unknown module "undefined"` → `createSkiaFrameProcessor` → `useSkiaFrameProcessor` (from crash.txt logcat). Cause: the `react-native-vision-camera-face-detector` `<Camera>` **wrapper** runs a Skia frame processor that lazily requires `@shopify/react-native-skia`, which isn't installed → JS exception crashes the app. Fix: rewrote `LivenessCamera.tsx` to use PLAIN `react-native-vision-camera` `<Camera>` with a REGULAR frame processor (`useFrameProcessor` + `runAtTargetFps(5,...)`) and `useFaceDetector().detectFaces(frame)`, marshalling results to JS via `Worklets.createRunOnJS` — no Skia dependency. Verified: tsc clean, Metro bundles 1435 modules incl. the worklet transform, 0 resolve errors. **Requires APK rebuild.** NOTE: user builds from their Mac — must Save to GitHub → pull/download ZIP so the change is in the uploaded project.

- **[15 Jun 2026]** REBRAND → "StayPin" + iOS BUILD/RUNTIME FIXES:
  - Rebranded app+web+backend from "Geofence/Attendance Console" to **StayPin**; bundle id/package → `com.staypin.app` (kept EAS slug `geofence-attendance` unchanged). New Firebase config files (project `attend-11366`) placed in `mobile/config/`.
  - iOS EAS build chain fixes: pinned `node 20.19.4` + `ios.image=latest` (Xcode 26, required for App Store/TestFlight as of Apr 28 2026) in `eas.json`; bumped iOS `deploymentTarget` 15.1→16.0; added `withFmtConstevalFix.js` (patches fmt `base.h` FMT_USE_CONSTEVAL=0 for Xcode 26 C++) and `withExpoLocalizationFix.js` (adds `@unknown default` to `calendar.identifier` switch for iOS 26 SDK).
  - **iOS login crash fix (iteration_31 regression pass):** TestFlight app crashed the instant a login field was focused (keyboard opened), before typing. Root cause: `react-native-reanimated` (dragged in only by **unused** `expo-router`) installs an iOS keyboard-event hook that crashed. Both packages were completely unused (app uses React Navigation + a custom `App.tsx`; camera uses `react-native-worklets-core`, not reanimated). Fix: removed `react-native-reanimated` + `expo-router` (deps + reanimated babel plugin + expo-router app.json plugin). tsc clean; backend auth + web login regression 100%. **iOS crash itself must be confirmed by the user on a rebuilt TestFlight binary** — not testable in-sandbox.
  - **Follow-on bundling fix:** removing reanimated pruned a transitive Babel dep that `react-native-worklets-core`'s plugin needs, so `expo export:embed` failed with `Cannot find module '@babel/plugin-transform-template-literals'` inside `makeWorklet`. Fix: added `@babel/plugin-transform-template-literals@7.29.7` (matches `@babel/core` 7.29.7; Babel-7 line stays Node-20 compatible — the `@latest` pulled a Babel-8 helper needing Node 22+). Verified by re-running the real bundler: all **1262 modules bundle + the LivenessCamera worklet transforms** (only the Linux sandbox's Hermes binary can't run, which is environment-only and works on EAS macOS).


- **[14 Jun 2026]** OFFLINE SCHEDULED SELFIES (anti-cheat) — closes the "switch off internet, drop the phone, answer the selfie later" loophole. Selfies are now scheduled + fired ON-DEVICE at random times and captured fully offline; the identity match stays server-side (dlib) and runs when the phone reconnects.
  - **Backend** (tested, 16/16 pytest pass — iteration_30):
    - `POST /api/mobile/selfie-sync` — bulk, idempotent on `(user_id, client_selfie_id)`. `captured` drafts run `face_match.analyze` (threshold 0.93) → `verified` / `mismatch` / `no_face`; `missed` drafts (employee absent) recorded with the real timestamp. Mismatch/no_face/missed log a `face_mismatch`/`selfie_missed` security event and, if a live session exists, flag it (`flagged=true` + log entry) exactly like an online miss.
    - `GET /api/mobile/reconcile` now returns `selfie_config` (challenges_per_shift, response_window_minutes, mode, fixed_times, active_liveness) + `schedule` so the phone can self-schedule offline.
    - Admin: `GET /api/offline-selfies?status=all|verified|missed|mismatch|flagged`, `GET /api/offline-selfies/{id}/photo`, `POST /api/offline-selfies/{id}/review`. Admin-only (employee 403). New `offline_selfies` collection + unique index `(user_id, client_selfie_id)`.
  - **Web** (screenshot-verified): new **Selfies** nav item → `/admin/offline-selfies` (`OfflineSelfies.jsx`) with status filters, per-card employee/time/similarity/battery, view-photo, and Mark reviewed.
  - **Mobile** (tsc clean; needs APK rebuild — not device-testable here): `offlineSelfie.ts` plans N random daily triggers within the shift window from the cached config and schedules OS local notifications (fire offline even when app killed); `offlineQueue.ts` gains an `offline_selfies` SQLite table; `ChallengeContext` surfaces a due offline selfie through the SAME `ChallengeModal` (offline capture → SQLite draft, no POST); `connectivity.ts`/`AuthContext` drain drafts + sweep MISSED on reconnect. Identity is NOT matched on-device (dlib can't run in RN + on-device verdicts are spoofable) — only liveness (blink) + timestamp are proven offline.


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
