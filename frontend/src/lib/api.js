import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Automatic refresh on 401
let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config || {};
    if (err.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      try {
        refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
        await refreshing;
        return api(original);
      } catch (e) {
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function toApiError(err) {
  return formatApiError(err?.response?.data?.detail) || err?.message || "Unknown error";
}

export const BACKEND = BACKEND_URL;
