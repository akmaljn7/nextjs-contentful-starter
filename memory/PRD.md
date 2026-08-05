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
- **P0** — Bulk CSV employee import
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
