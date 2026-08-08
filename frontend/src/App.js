import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import LoginPage from "@/pages/Login";
import RegisterOrgPage from "@/pages/RegisterOrg";
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";
import AdminDashboard from "@/pages/AdminDashboard";
import OfficesManage from "@/pages/OfficesManage";
import EmployeesManage from "@/pages/EmployeesManage";
import EmployeeConsole from "@/pages/EmployeeConsole";
import AttendanceHistory from "@/pages/AttendanceHistory";
import Reports from "@/pages/Reports";
import AuditLog from "@/pages/AuditLog";
import SecurityEvents from "@/pages/SecurityEvents";
import OrgSettings from "@/pages/OrgSettings";
import EmployeeProfile from "@/pages/EmployeeProfile";
import TimeOff from "@/pages/TimeOff";
import GapReviews from "@/pages/GapReviews";

function RootRedirect() {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen flex items-center justify-center label-uppercase">CHECKING SESSION…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "employee" ? "/employee" : "/admin"} replace />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#121212", border: "1px solid rgba(255,255,255,0.1)", color: "#f9fafb", fontFamily: "IBM Plex Mono, monospace", fontSize: 13 } }} />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterOrgPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={["org_owner", "admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/offices" element={<ProtectedRoute roles={["org_owner", "admin"]}><OfficesManage /></ProtectedRoute>} />
            <Route path="/admin/employees" element={<ProtectedRoute roles={["org_owner", "admin"]}><EmployeesManage /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute roles={["org_owner", "admin"]}><AttendanceHistory /></ProtectedRoute>} />
            <Route path="/admin/gaps" element={<ProtectedRoute roles={["org_owner", "admin"]}><GapReviews /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={["org_owner", "admin"]}><Reports /></ProtectedRoute>} />
            <Route path="/admin/audit" element={<ProtectedRoute roles={["org_owner", "admin"]}><AuditLog /></ProtectedRoute>} />
            <Route path="/admin/security" element={<ProtectedRoute roles={["org_owner", "admin"]}><SecurityEvents /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute roles={["org_owner", "admin"]}><OrgSettings /></ProtectedRoute>} />
            <Route path="/admin/time-off" element={<ProtectedRoute roles={["org_owner", "admin"]}><TimeOff /></ProtectedRoute>} />

            {/* Employee */}
            <Route path="/employee" element={<ProtectedRoute roles={["employee"]}><EmployeeConsole /></ProtectedRoute>} />
            <Route path="/employee/history" element={<ProtectedRoute roles={["employee"]}><AttendanceHistory /></ProtectedRoute>} />
            <Route path="/employee/time-off" element={<ProtectedRoute roles={["employee"]}><TimeOff /></ProtectedRoute>} />
            <Route path="/employee/profile" element={<ProtectedRoute roles={["employee"]}><EmployeeProfile /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
