import React from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

export default function EmployeeProfile() {
  const { user } = useAuth();
  const { data: offices = [] } = useQuery({ queryKey: ["offices"], queryFn: async () => (await api.get("/offices")).data });
  const office = offices.find((o) => o.id === user?.office_id);

  return (
    <AppShell>
      <div className="mb-6">
        <div className="label-uppercase">PROFILE</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">{user?.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        <div className="surface p-5" data-testid="profile-info">
          <div className="label-uppercase mb-3">IDENTITY</div>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">NAME</dt><dd className="mt-0.5">{user?.name}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">EMAIL</dt><dd className="mt-0.5 mono">{user?.email}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">ROLE</dt><dd className="mt-0.5 mono uppercase tracking-widest text-xs">{user?.role}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">MEMBER SINCE</dt><dd className="mt-0.5 mono text-xs">{fmtDateTime(user?.created_at)}</dd></div>
          </dl>
        </div>

        <div className="surface p-5" data-testid="profile-org">
          <div className="label-uppercase mb-3">ASSIGNMENT</div>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">ORG</dt><dd className="mt-0.5">{user?.org_name}</dd></div>
            <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">OFFICE</dt><dd className="mt-0.5">{office ? office.name : "— unassigned —"}</dd></div>
            {office && (
              <>
                <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">COORDINATES</dt><dd className="mt-0.5 mono text-xs">{office.lat.toFixed(6)}, {office.lng.toFixed(6)}</dd></div>
                <div><dt className="text-gray-500 mono text-[10px] uppercase tracking-widest">RADIUS</dt><dd className="mt-0.5 mono">{office.radius_meters} m</dd></div>
              </>
            )}
          </dl>
        </div>
      </div>
    </AppShell>
  );
}
