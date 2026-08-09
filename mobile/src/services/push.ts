/**
 * Push notification client — Phase 3.
 *
 * Uses `expo-notifications` for both display and token registration. When
 * FCM is properly wired server-side (FCM_SERVICE_ACCOUNT_JSON set), the
 * server will fan out a push per selfie challenge; when it isn't, it logs
 * a stub — this file's client-side code still runs and requests a token
 * exactly the same way. Tokens are registered on the backend via
 * /api/mobile/register-device (Phase 0) so no new endpoint is needed.
 *
 * Push data payload shape (from server-side send_push):
 *   { kind: "selfie_challenge", challenge_id: string,
 *     session_id: string, respond_by_ms: string,  manual?: "true" }
 */
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { mobile } from "@/api/mobile";
import { getDeviceId } from "@/lib/storage";

// Foreground behaviour — show a heads-up notification even when the app is
// on top so the user isn't blindsided by a selfie prompt appearing under it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("attendance", {
    name: "Attendance & selfie check-ins",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
    lightColor: "#10b981",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Registers the device with FCM and posts the push token to our backend.
 * Safe to call repeatedly — the backend upserts by (user, device).
 * Returns the token (or null when running in Expo Go / simulator).
 */
export async function registerForPushAsync(): Promise<string | null> {
  await ensureAndroidChannel();
  const perm = await Notifications.getPermissionsAsync();
  let status = perm.status;
  if (status !== "granted") {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = asked.status;
  }
  if (status !== "granted") return null;

  // Prefer the raw platform-native token so our backend can talk to APNs +
  // FCM directly. Expo Push Service is not used because we own the FCM
  // pipeline server-side.
  let token: string | null = null;
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    token = t.data as string;
  } catch { /* running in Expo Go — no native FCM available */ }

  if (!token) return null;
  try {
    await mobile.registerDevice({
      device_id: await getDeviceId(),
      platform: Platform.OS === "ios" ? "ios" : "android",
      push_token: token,
      app_version: Constants.expoConfig?.version || "1.0.0",
    });
  } catch { /* non-fatal — will retry on next launch */ }
  return token;
}

interface ChallengeCtx {
  challenge_id: string;
  session_id: string;
  respond_by_ms: number;
  manual: boolean;
  for_name?: string;
}

/**
 * Read the FCM data payload out of a notification. Returns null if this
 * notification isn't a selfie challenge (e.g. a plain reminder or a
 * different kind of alert we might add later).
 */
export function parseChallengePayload(payload: any): ChallengeCtx | null {
  const data = payload?.request?.content?.data
    || payload?.notification?.request?.content?.data
    || payload?.data;
  if (!data) return null;
  if (data.kind !== "selfie_challenge") return null;
  const respondBy = Number(data.respond_by_ms);
  if (!data.challenge_id || !Number.isFinite(respondBy)) return null;
  return {
    challenge_id: String(data.challenge_id),
    session_id: String(data.session_id || ""),
    respond_by_ms: respondBy,
    manual: data.manual === "true" || data.manual === true,
    for_name: data.for_name ? String(data.for_name) : undefined,
  };
}

/**
 * Register two listeners:
 *   - notification received while foregrounded (auto-open modal)
 *   - user taps notification while backgrounded (deep-link)
 * Returns an unsubscribe fn.
 */
export function subscribeChallenges(
  onChallenge: (ctx: ChallengeCtx) => void,
): () => void {
  const s1 = Notifications.addNotificationReceivedListener((n) => {
    const c = parseChallengePayload(n);
    if (c) onChallenge(c);
  });
  const s2 = Notifications.addNotificationResponseReceivedListener((r) => {
    const c = parseChallengePayload(r);
    if (c) onChallenge(c);
  });
  // Handle the "app opened by tapping a notification while completely killed"
  // case — the last response is queued for us.
  Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r) {
      const c = parseChallengePayload(r);
      if (c) onChallenge(c);
    }
  });
  return () => { s1.remove(); s2.remove(); };
}
