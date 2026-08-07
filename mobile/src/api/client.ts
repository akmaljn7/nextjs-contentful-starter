import axios, { AxiosError, AxiosInstance } from "axios";
import Constants from "expo-constants";
import { secureGet, secureSet, secureDelete } from "@/lib/storage";

/**
 * Backend base URL. Resolved at runtime from `app.json` -> `extra.apiUrl`
 * so different EAS profiles (dev, preview, production) can point to
 * different backends. Falls back to the current production URL.
 */
export const BASE_URL = (
  (Constants.expoConfig?.extra as any)?.apiUrl ||
  "https://geofence-admin-1.preview.emergentagent.com"
).replace(/\/+$/, "");

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export async function saveTokens(access: string, refresh: string) {
  await secureSet(ACCESS_KEY, access);
  await secureSet(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await secureDelete(ACCESS_KEY);
  await secureDelete(REFRESH_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return secureGet(ACCESS_KEY);
}

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15_000,
  // Cookies aren't reliable on native — we use Bearer tokens everywhere.
  withCredentials: false,
});

// Attach Authorization header on every outgoing request
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh-on-401 flow — retry the original request once with a fresh access token
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = await secureGet(REFRESH_KEY);
      if (!refresh) return null;
      const r = await axios.post(`${BASE_URL}/api/auth/refresh`, { refresh_token: refresh }, {
        withCredentials: false, timeout: 12_000,
      });
      const at = r.data?.access_token;
      const rt = r.data?.refresh_token;
      if (at) await secureSet(ACCESS_KEY, at);
      if (rt) await secureSet(REFRESH_KEY, rt);
      return at || null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original: any = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retried = true;
      const fresh = await refreshAccessToken();
      if (fresh) {
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${fresh}`;
        return api.request(original);
      }
      // Refresh failed → wipe tokens so AuthContext gates back to login
      await clearTokens();
    }
    return Promise.reject(error);
  }
);

export function apiError(e: unknown): string {
  const err = e as AxiosError<any>;
  if (err.response?.data?.detail) {
    const d = err.response.data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  }
  if (err.message) return err.message;
  return "Something went wrong. Please try again.";
}
