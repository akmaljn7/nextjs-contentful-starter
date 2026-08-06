import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import { Platform } from "react-native";

/**
 * Encrypted key/value storage backed by iOS Keychain / Android EncryptedShared-
 * Preferences via `expo-secure-store`. Used for JWTs, refresh tokens, and any
 * long-lived secret. NEVER put a plaintext password here.
 */
const PREFIX = "gfattend.";

export async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(PREFIX + key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PREFIX + key);
  } catch {
    return null;
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PREFIX + key);
  } catch {
    // ignore
  }
}

const DEVICE_ID_KEY = "device_id";

/**
 * Stable device id — used to correlate mobile events with a specific install.
 * On iOS uses `identifierForVendor` (survives updates, wiped on uninstall).
 * On Android uses `getAndroidId()` from expo-application (survives update).
 * Falls back to a generated UUID stored in secure-store if the native id is
 * unavailable, so we always have something.
 */
export async function getDeviceId(): Promise<string> {
  const cached = await secureGet(DEVICE_ID_KEY);
  if (cached) return cached;
  let id: string | null = null;
  try {
    if (Platform.OS === "ios") {
      id = await Application.getIosIdForVendorAsync();
    } else if (Platform.OS === "android") {
      id = Application.getAndroidId();
    }
  } catch {
    id = null;
  }
  if (!id) {
    id = `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  await secureSet(DEVICE_ID_KEY, id);
  return id;
}
