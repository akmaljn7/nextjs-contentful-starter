import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="label-uppercase" data-testid="auth-loading">CHECKING SESSION…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role) && user.role !== "super_admin") {
    return <Navigate to={user.role === "employee" ? "/employee" : "/admin"} replace />;
  }
  return children;
}
