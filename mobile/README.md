# Attendance Console — Mobile

React Native + Expo SDK 52 app for iOS and Android. Shares its backend with
the existing web dashboard (FastAPI + MongoDB, one JWT-based API).

## Project scope by phase

| Phase | Status | What ships |
|-------|--------|------------|
| **P0** — Backend prep | ✅ Done | `/api/mobile/*` endpoints, FCM push service (stub without creds), MongoDB indexes |
| **P1** — App shell + auth | ✅ Done | Login, role routing, secure JWT storage, device registration, tab navigation, placeholder home screens for both roles |
| **P2** — BG geofencing + offline queue | ⏳ Next | `expo-location` geofence, SQLite queue, sync worker, 6 reliability fixes (boot receiver, cold-start reconcile, etc.) |
| **P3** — Push + selfie challenges | Planned | FCM setup, camera capture, response upload |
| **P4** — Admin flow: live map | Planned | `react-native-maps`, send-selfie-now, end-session |
| **P5** — Admin flow: offices/employees/reports | Planned | CRUD screens, CSV/PDF viewers |
| **P6** — Anti-spoof + polish | Planned | Play Integrity, mock-loc guard, battery whitelist wizard |
| **P7** — Real-device testing | Planned | iPhone SE→15 Pro, Android 8→14, various OEMs |
| **P8** — Store submission | Planned | Privacy policies, screenshots, review cycles |

## Getting started locally

```bash
cd /app/mobile
yarn install   # already done for you if you see /app/mobile/node_modules

# Start the dev server + open in Expo Go on your phone
yarn start
```

Scan the QR code with the **Expo Go** app to run it. For features that need
native modules (geofencing, push, camera), you'll need a **Development
Build** — see the next section.

## Building a Development Build (needed for Phase 2+)

```bash
# One-time — you'll be prompted to log into Expo and pick a project
npx eas login
npx eas init         # links a project id — updates app.json extra.eas.projectId

# Preview build (installable APK / TestFlight IPA)
yarn eas:build:preview:android    # ~10-15 min
yarn eas:build:preview:ios        # ~15-20 min
```

The resulting build ships an `expo-dev-client` that lets you keep using the
JS hot-reload workflow, but with real native modules available.

## Environment configuration

The backend URL lives in `app.json → expo.extra.apiUrl`. Change it there and
re-run the dev server. Do NOT put secrets in `app.json` — that file ships in
the binary.

Secrets (JWT tokens) are stored in `expo-secure-store`, which is backed by
iOS Keychain and Android EncryptedSharedPreferences.

## Testing

Manual for now (Phase 1). Use the seeded accounts:

- **Admin**: `akmaljn7@gmail.com` / `GeofenceAdmin123!` → lands on the Live tab
- **Employee**: `employee@example.com` / `Employee123!` → lands on Home

After signing in the app calls `/api/mobile/register-device` idempotently.
You can verify by hitting the backend:

```
curl -H "Cookie: access_token=..." $API/api/mobile/devices
```

Automated E2E via Detox comes in Phase 7.

## Files of interest

```
/app/mobile
├── App.tsx                       # root providers
├── src/
│   ├── api/                      # backend client (axios + auto-refresh)
│   ├── context/AuthContext.tsx   # login state, device registration hook
│   ├── lib/                      # SecureStore wrapper, device id, react-query
│   ├── navigation/               # Auth / Employee / Admin stacks
│   ├── screens/                  # LoginScreen, ForgotPasswordScreen, Home×2, etc.
│   ├── components/               # Button, Input, Screen wrappers
│   └── theme/                    # dark-theme design tokens
```

## What Phase 1 explicitly does NOT do yet

- Background location or geofence registration
- Camera / selfie capture
- Push notifications
- Full admin CRUD
- Live map view

Each of those is one clearly-scoped phase away.
