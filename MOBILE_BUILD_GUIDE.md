# Build & install the Attendance Mobile App on a real phone

Everything in this repo is ready. This guide takes you from **your laptop → APK on your Android phone → live pushes from the web console**. Total time: ~20 min (first time), 10 min after that.

**Skip iOS for now** — iOS requires an Apple Developer account ($99/year) and TestFlight setup. Android APK is free and installs in one tap.

---

## What you're building

- **Preview APK**: a real Android app signed for internal distribution
- **Bundle ID / package**: `com.geofenceattendance.app`
- **Firebase project**: `attend-11366` (already wired)
- **Backend it hits**: `https://geofence-admin-1.preview.emergentagent.com`

---

## Prerequisites (one-time, ~5 min)

1. **Free Expo account** — sign up at https://expo.dev
2. **Node.js 18+** on your laptop — `node --version` should be `v18.x` or `v20.x`
3. **Android phone** with USB cable OR "Install unknown apps" enabled

You do **not** need Android Studio. EAS builds in the cloud.

---

## Step 1 — Get the mobile code onto your laptop

Two options:

### Option A — Use the Emergent "Save to GitHub" feature (recommended)
1. In the chat input on this Emergent job, use **"Save to GitHub"** to push everything
2. On your laptop: `git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git`
3. `cd YOUR-REPO/mobile`

### Option B — Zip and download from the container
1. Ask me: "zip the mobile folder and give me a download link" — I'll create a tarball you can download
2. Extract → `cd mobile`

**Files you MUST also have locally** (already in the repo, but git-ignored, so verify they made it over):
- `mobile/config/GoogleService-Info.plist`
- `mobile/config/google-services.json`
- `mobile/assets/` (icon.png, splash.png, adaptive-icon.png, notification-icon.png)

If any are missing, ask me to send them.

---

## Step 2 — Install EAS CLI (30 sec)

```bash
npm install -g eas-cli
eas --version   # should show 12.x or higher
```

---

## Step 3 — Log in to Expo (30 sec)

```bash
eas login
```

Paste your Expo account email + password.

---

## Step 4 — Install project dependencies (2-3 min)

From inside the `mobile/` folder:

```bash
yarn install
```

If `yarn` isn't installed: `npm install -g yarn` then re-run.

---

## Step 5 — Initialize EAS project (1 min)

Still in `mobile/`:

```bash
eas init
```

This will:
- Ask if you want to create a new project → **Yes**
- Set the project name (accept default: `geofence-attendance`)
- Automatically fill in `expo.extra.eas.projectId` in `app.json`
- Automatically fill in `expo.updates.url`

After it finishes, open `mobile/app.json` and set `expo.owner` to your Expo username (the one you signed up with in Step 3, e.g. `owner: "yourname"`).

---

## Step 6 — Trigger the build (1 min to submit, ~10 min to bake)

```bash
eas build --profile preview --platform android
```

What happens:
1. EAS uploads your project to their build servers
2. Prompts about generating a keystore → **Yes, generate a new one** (they store it securely, free)
3. Cloud build starts. You'll see a URL like `https://expo.dev/accounts/.../projects/.../builds/xxx`
4. Watch progress in real-time on that URL (or in your terminal)
5. When done: a **QR code** appears and a direct APK download link

---

## Step 7 — Install the APK on your phone

Three ways (use whichever is easiest):

### 7a. Scan the QR code with your phone
- Open your phone's camera → point at the QR code that eas prints
- Follow the "Install" prompt

### 7b. Direct link
- After build completes, EAS prints a URL like `https://expo.dev/artifacts/eas/...apk`
- Text/email that URL to yourself → tap on your phone → Chrome downloads it → tap "Install"

### 7c. USB
- On the build page, click **Download**
- Connect phone via USB, drag the `.apk` into your phone's Downloads folder
- Open the file manager on the phone → tap the APK → Install

**Android will warn "Unknown source"** the first time. Tap "Settings" → toggle "Allow from this source" for your browser/file manager → back → tap Install. This is normal for internal distribution.

---

## Step 8 — First launch: grant permissions

The app will ask, in order:
1. **Notifications** — say **Allow** (needed for selfie challenges + silent wake-ups)
2. **Location, all the time** — say **Allow all the time** (critical — geofencing does not work with "Only while using")
3. **Camera** — say **Allow** (needed for selfie challenges)

Then log in with your credentials:
- **Admin**: `akmaljn7@gmail.com` / `GeofenceAdmin123!`
- **Employee**: `employee@example.com` / `Employee123!`

---

## Step 9 — Verify live pushes work

**On the phone** (as employee):
1. Log in as `employee@example.com`
2. You'll see the Employee dashboard with a status chip

**On your laptop** (as admin, in a browser):
1. Go to https://geofence-admin-1.preview.emergentagent.com/login
2. Log in as `akmaljn7@gmail.com`
3. Open the live map → click the employee's row → click **"Send selfie challenge"**

**On the phone**: within 1-3 seconds, a push notification lands and taps into the selfie camera. ✅ Live FCM working end-to-end.

---

## Common issues

| Problem | Fix |
|---|---|
| `eas init` fails "not a git repo" | Run `git init` inside `mobile/` first |
| Build fails "Missing google-services.json" | Confirm the file exists at `mobile/config/google-services.json` (Step 1, git-ignored so may not have copied) |
| APK installs but no push arrives | Phone permissions weren't granted; go to Settings → Apps → Attendance Console → Permissions and enable Notifications + Location "All the time" |
| Build succeeds but app crashes on open | Check the build logs on expo.dev; usually a missing asset — verify `mobile/assets/*.png` all exist |
| "Unable to find expo project id" | You skipped Step 5. Run `eas init` inside `mobile/` |

---

## For iOS later (skip for now)

When you're ready:
1. Get an Apple Developer account: https://developer.apple.com/programs/ ($99/year)
2. Run `eas build --profile preview --platform ios`
3. EAS handles all provisioning profiles / signing automatically
4. Install via TestFlight (email invite) or ad-hoc `.ipa`

---

## Cost

- **EAS Free tier**: 30 builds/month, plenty for testing
- Bandwidth for APK downloads: unlimited via EAS

That's it. First build usually takes 12-15 min because they're cold-starting a container. Subsequent builds are 5-8 min because caches warm up.
