import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, toApiError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=none, obj=logged in
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      return data;
    } catch (e) {
      setError(toApiError(e));
      throw e;
    }
  };

  const registerOrg = async (payload) => {
    setError("");
    try {
      const { data } = await api.post("/auth/register-org", payload);
      setUser(data);
      return data;
    } catch (e) {
      setError(toApiError(e));
      throw e;
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* noop */ }
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, error, setError, login, registerOrg, logout, refresh: load }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
