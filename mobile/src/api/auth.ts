import { api, saveTokens, clearTokens } from "@/api/client";

export type Role = "org_owner" | "admin" | "employee";

export interface AuthUser {
  id: string;
  org_id: string;
  org_name?: string | null;
  email: string;
  name: string;
  role: Role;
  office_id?: string | null;
  schedule?: any;
}

interface LoginResponse extends AuthUser {
  access_token: string;
  refresh_token: string;
  token_type?: string;
}

/** POST /api/auth/login — issues JWT pair and returns the user profile. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<LoginResponse>("/auth/login", {
    email: email.trim().toLowerCase(),
    password,
  });
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Login response missing tokens. Server may not be up to date.");
  }
  await saveTokens(data.access_token, data.refresh_token);
  return { id: data.id, org_id: data.org_id, org_name: data.org_name,
           email: data.email, name: data.name,
           role: data.role, office_id: data.office_id, schedule: data.schedule };
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me");
  return data;
}

export async function logout() {
  try { await api.post("/auth/logout"); } catch { /* best-effort */ }
  await clearTokens();
}

export async function forgotPassword(email: string) {
  await api.post("/auth/forgot-password", { email });
}
