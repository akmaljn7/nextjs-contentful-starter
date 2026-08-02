import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Radar, Building2, Users, ClipboardList, ShieldAlert, FileBarChart, Settings, User } from "lucide-react";

const ADMIN_NAV = [
  { to: "/admin", label: "Console", icon: Radar, testid: "nav-console" },
  { to: "/admin/offices", label: "Offices", icon: Building2, testid: "nav-offices" },
  { to: "/admin/employees", label: "Employees", icon: Users, testid: "nav-employees" },
  { to: "/admin/attendance", label: "Attendance", icon: ClipboardList, testid: "nav-attendance" },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart, testid: "nav-reports" },
  { to: "/admin/audit", label: "Audit Log", icon: ClipboardList, testid: "nav-audit" },
  { to: "/admin/security", label: "Security", icon: ShieldAlert, testid: "nav-security" },
  { to: "/admin/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

const EMPLOYEE_NAV = [
  { to: "/employee", label: "Session", icon: Radar, testid: "nav-session" },
  { to: "/employee/history", label: "History", icon: ClipboardList, testid: "nav-history" },
  { to: "/employee/profile", label: "Profile", icon: User, testid: "nav-profile" },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const items = user?.role === "employee" ? EMPLOYEE_NAV : ADMIN_NAV;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to={user?.role === "employee" ? "/employee" : "/admin"} className="flex items-center gap-2" data-testid="logo-link">
              <div className="w-6 h-6 border border-green-500 grid place-items-center">
                <div className="live-pin pin-active" style={{ width: 6, height: 6 }} />
              </div>
              <div>
                <div className="label-uppercase" style={{ letterSpacing: "0.24em", fontSize: 10 }}>GEOFENCE</div>
                <div className="text-sm font-medium leading-tight">Attendance Console</div>
              </div>
            </Link>
            <div className="hidden md:block h-8 w-px bg-white/10" />
            <nav className="hidden md:flex items-center gap-1">
              {items.map((it) => {
                const active = loc.pathname === it.to || (it.to !== "/admin" && it.to !== "/employee" && loc.pathname.startsWith(it.to));
                const Icon = it.icon;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    data-testid={it.testid}
                    className={`px-3 py-1.5 text-xs uppercase tracking-widest font-mono transition-colors ${active ? "text-white border-b border-green-500" : "text-gray-400 hover:text-white"}`}
                  >
                    <span className="inline-flex items-center gap-1.5"><Icon size={13} strokeWidth={1.75} />{it.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-400 mono">{user?.org_name}</div>
              <div className="text-sm">{user?.name} <span className="text-gray-500 mono text-[10px] uppercase tracking-wider ml-1">{user?.role}</span></div>
            </div>
            <button
              onClick={async () => { await logout(); nav("/login"); }}
              className="border border-white/10 hover:border-white/30 px-3 py-1.5 text-xs uppercase tracking-widest font-mono transition-colors flex items-center gap-1.5"
              data-testid="logout-btn"
            >
              <LogOut size={13} strokeWidth={1.75} /> Logout
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {items.map((it) => {
            const active = loc.pathname === it.to || (it.to !== "/admin" && it.to !== "/employee" && loc.pathname.startsWith(it.to));
            return (
              <Link
                key={it.to}
                to={it.to}
                data-testid={`m-${it.testid}`}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono whitespace-nowrap ${active ? "text-white border-b border-green-500" : "text-gray-400"}`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 sm:px-8 py-6">{children}</main>
    </div>
  );
}
