import { api } from "@/api/client";

export const colleague = {
  checkin: (p: { email_or_id: string; reason: string; lat: number; lng: number; accuracy: number }) =>
    api.post("/colleague/checkin", p).then((r) => r.data),
  selfie: (p: { email_or_id: string; challenge_id?: string; face_photo: string }) =>
    api.post("/colleague/selfie", p).then((r) => r.data),
  checkout: (p: { email_or_id: string; face_photo: string }) =>
    api.post("/colleague/checkout", p).then((r) => r.data),
  gapReason: (p: { email_or_id: string; note: string; face_photo?: string; evidence_photo?: string; gap_id?: string }) =>
    api.post("/colleague/gap-reason", p).then((r) => r.data),
};
