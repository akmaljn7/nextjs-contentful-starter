import { api } from "@/api/client";

export interface MobileEventPayload {
  client_event_id: string;
  device_id: string;
  type: "enter" | "exit" | "cold_start_reconcile";
  ts_ms: number;
  office_id: string;
  lat: number;
  lng: number;
  accuracy: number;
  mock_location?: boolean;
  from_boot?: boolean;
  battery?: number;
}

export interface RegisterDevicePayload {
  device_id: string;
  platform: "ios" | "android";
  push_token?: string;
  app_version: string;
  os_version?: string;
  tz?: string;
  locale?: string;
  model?: string;
}

export interface ReconcileState {
  office: { id: string; name: string; lat: number; lng: number; radius_meters: number } | null;
  session: { id: string; status: string; start_time_ms: number;
             remaining_ms: number; center: any; flagged: boolean } | null;
  last_event: { type: string; ts_ms: number; client_event_id: string; outcome: string | null } | null;
  server_ts_ms: number;
}

export const mobile = {
  registerDevice: (p: RegisterDevicePayload) => api.post("/mobile/register-device", p).then((r) => r.data),
  unregisterDevice: (deviceId: string) => api.delete(`/mobile/register-device/${deviceId}`).then((r) => r.data),
  listDevices: () => api.get("/mobile/devices").then((r) => r.data),
  postEvent: (e: MobileEventPayload) => api.post("/mobile/geofence-event", e).then((r) => r.data),
  bulkSync: (events: MobileEventPayload[]) => api.post("/mobile/sync", { events }).then((r) => r.data),
  heartbeat: (payload: { device_id: string; ts_ms: number; battery?: number;
                         permission_state?: string; last_geofence_event_ms?: number }) =>
    api.post("/mobile/heartbeat", payload).then((r) => r.data),
  reconcile: (): Promise<ReconcileState> => api.get("/mobile/reconcile").then((r) => r.data),
};
