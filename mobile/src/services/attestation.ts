/**
 * Device attestation — Phase 6.
 *
 * Wraps Play Integrity (Android) and App Attest (iOS) so that any critical
 * event (device registration, first geofence event of a shift, cold-start
 * reconcile) can be accompanied by a fresh device-integrity proof.
 *
 * For now the client mints a signed placeholder (`stub-<nonce>-<hex>`) that
 * the server records under `mobile_devices.attestation_verdict`. When
 * `expo-play-integrity` / equivalent Apple bindings are wired in Phase 7 we
 * just swap `_mintStubToken()` for the real API — the server contract is
 * unchanged.
 *
 * Behaviour is best-effort: if attestation fails or is unavailable we log,
 * fall back to null, and let the caller proceed. Anti-spoof is `soft`.
 */
import { Platform } from "react-native";

import { api } from "@/api/client";
import { getDeviceId } from "@/lib/storage";

const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;

function _randHex(len: number): string {
  let s = "";
  const chars = "abcdef0123456789";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function _makeNonce(): string {
  const nonce = `${Date.now().toString(36)}-${_randHex(16)}`;
  return nonce.slice(0, 40);
}

/**
 * Stub attestation token — will be replaced with real Play Integrity /
 * App Attest tokens in Phase 7. Format is deliberately identifiable so the
 * server can tag stubs as `stub_accepted` verdict instead of pretending they
 * were verified.
 */
function _mintStubToken(nonce: string, deviceId: string): string {
  const suffix = _randHex(24);
  return `stub-${nonce}-${deviceId.slice(0, 8)}-${suffix}`;
}

interface SubmitOptions {
  clientEventId?: string;
}

export interface AttestationResult {
  ok: boolean;
  verdict?: "ok" | "invalid_structure" | "stub_accepted";
  reason?: string;
}

export async function submitAttestation(opts: SubmitOptions = {}): Promise<AttestationResult> {
  try {
    const deviceId = await getDeviceId();
    const nonce = _makeNonce();
    if (!NONCE_RE.test(nonce)) {
      return { ok: false, reason: "bad_nonce" };
    }
    const token = _mintStubToken(nonce, deviceId);
    const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
    const r = await api.post("/mobile/attestation", {
      device_id: deviceId,
      platform,
      token,
      nonce,
      ts_ms: Date.now(),
      client_event_id: opts.clientEventId,
    });
    return { ok: true, verdict: r.data?.verdict };
  } catch (e: any) {
    return { ok: false, reason: e?.response?.data?.detail || e?.message || "attestation_failed" };
  }
}
