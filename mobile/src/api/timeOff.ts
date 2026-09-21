import { api } from "@/api/client";

export interface LeaveRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  created_at?: string;
  decided_at?: string | null;
  decided_by_name?: string;
  decision_notes?: string | null;
}

export const timeOff = {
  mine: (): Promise<LeaveRequest[]> => api.get("/time-off/me").then((r) => r.data),
  create: (p: { start_date: string; end_date: string; reason: string }): Promise<LeaveRequest> =>
    api.post("/time-off", p).then((r) => r.data),
  cancel: (id: string): Promise<{ ok: boolean }> =>
    api.delete(`/time-off/${id}`).then((r) => r.data),
};
