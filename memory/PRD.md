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

## Implemented (2026-02)
### Backend
- FastAPI with `/api` prefix, MongoDB (Motor), 2dsphere geo index, TTL index on pings
- Auth: register-org, login, refresh (rotating), logout, me, forgot-password, reset-password (Resend email via Emergent proxy)
- Offices CRUD + `admin_audit_log`
- Employees CRUD + reassign flow
- Sessions: `/start`, `/ping`, `/reset`, `/me`, `/live`, `/force-expire/{user_id}` — server-authoritative state machine (active → paused → active → completed / expired)
- Attendance: `/records`, `/export.csv`, `/export.pdf` (reportlab), `/summary`
- Audit log + security events (admin views)
- Org settings (session duration, resume window, accuracy tolerance, max speed, spoof sensitivity, notifications)
- Anti-spoof engine: accuracy > tolerance rejects/flags, impossible-speed flags + optional owner email alert
- Immutable hash-chained attendance records
- Rate-limit-style login attempt tracking with 15-min lockout
- Startup seed: `akmaljn7@gmail.com` owner + demo office + sample employee

### Frontend
- React 19 + CRA, Tailwind, Shadcn UI, React Query, sonner toasts
- react-leaflet with Esri World Imagery satellite tiles
- Pages: Login, Register Org, Forgot/Reset Password, Admin Dashboard (live map + stats grid + live sessions), Offices Manage, Employees Manage, Employee Console (map + countdown + telemetry + event log), Attendance History (filters + CSV/PDF), Reports (daily + top-employee), Audit Log, Security Events, Org Settings, Employee Profile
- Auth via httpOnly cookies + auto-refresh interceptor
- Live pins with CSS-only pulsing animation, status semantics (green/amber/blue/red)
- PWA manifest + service worker + install-ready icons

## Deferred / Backlog (P0/P1/P2)
- **P0** — Bulk CSV employee import
- **P0** — Real WebSocket channel (currently 3s polling for live pins)
- **P1** — Email invite for new employees with set-password link
- **P1** — Device fingerprint + IP-geo cross-check anti-spoof
- **P1** — SSO (Google/Microsoft) via Emergent Google Auth
- **P2** — GDPR data-export + hard-delete endpoints (right-to-be-forgotten)
- **P2** — APScheduler jobs for session expiry sweeps + refresh-token cleanup
- **P2** — Stripe billing per org
- **P2** — i18n
- **P2** — Landing / marketing page

## Test Credentials
See `/app/memory/test_credentials.md`
