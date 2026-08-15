import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ScheduleEditor, scheduleSummary } from "@/components/ScheduleEditor";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, X, User, Camera, Bell, Smartphone, Check, LogOut, Lock } from "lucide-react";

function EmployeeForm({ initial, offices, onCancel, onSaved }) {
  const [form, setForm] = useState(
    initial || { name: "", email: "", password: "", office_id: offices[0]?.id || "", schedule: { mode: "any" } }
  );

  const save = useMutation({
    mutationFn: async () => {
      if (initial?.id) {
        return (await api.patch(`/employees/${initial.id}`, {
          name: form.name, office_id: form.office_id, schedule: form.schedule || { mode: "any" },
        })).data;
      }
      return (await api.post("/employees", { ...form, schedule: form.schedule || { mode: "any" } })).data;
    },
    onSuccess: () => { toast.success(initial ? "Employee updated" : "Employee created"); onSaved(); },
    onError: (e) => toast.error(toApiError(e)),
  });
  const errorDetail = save.isError ? toApiError(save.error) : null;

  return (
    <div className="surface p-5" data-testid="employee-form">
      <div className="flex items-center justify-between mb-4">
        <div className="label-uppercase">{initial ? "EDIT EMPLOYEE" : "NEW EMPLOYEE"}</div>
        <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors" data-testid="close-emp-form"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div>
            <label className="label-uppercase block mb-1.5">Full Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="emp-name" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
          </div>
          {!initial && (
            <div>
              <label className="label-uppercase block mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="emp-email" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
            </div>
          )}
          {!initial && (
            <div>
              <label className="label-uppercase block mb-1.5">Temporary Password (min 8)</label>
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="emp-password" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
            </div>
          )}
          <div>
            <label className="label-uppercase block mb-1.5">Assign to Office</label>
            <select value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value })} data-testid="emp-office" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono">
              <option value="">— Select —</option>
              {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>

        <ScheduleEditor value={form.schedule} onChange={(s) => setForm({ ...form, schedule: s })} />
      </div>

      {errorDetail && (
        <div
          className="mt-4 border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2 text-sm"
          data-testid="emp-form-error"
        >
          <div className="mono text-[10px] uppercase tracking-widest text-red-400 mb-1">
            COULD NOT SAVE EMPLOYEE
          </div>
          <div>{errorDetail}</div>
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.office_id || (!initial && (!form.email || !form.password))} data-testid="emp-save" className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium px-4 py-2 text-sm transition-colors">{save.isPending ? "Saving…" : (initial ? "Save changes" : "Create employee")}</button>
        <button onClick={onCancel} className="border border-white/10 hover:border-white/30 px-4 py-2 text-sm transition-colors" data-testid="emp-cancel">Cancel</button>
      </div>
    </div>
  );
}

export default function EmployeesManage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });
  const { data: offices = [] } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/employees/${id}`)).data,
    onSuccess: () => { toast.success("Employee removed"); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const challengeNow = useMutation({
    mutationFn: async (userId) => (await api.post(`/sessions/challenge-now/${userId}`)).data,
    onSuccess: () => toast.success("Selfie challenge sent"),
    onError: (e) => {
      const msg = toApiError(e);
      // Fall back to plain nudge when there's no active session yet
      if (/no active session/i.test(msg)) {
        toast.info("No active session — sending a check-in reminder instead");
      } else {
        toast.error(msg);
      }
    },
  });

  const nudge = useMutation({
    mutationFn: async ({ userId, title, body }) =>
      (await api.post(`/sessions/nudge/${userId}`, { title, body })).data,
    onSuccess: (data) => toast.success(`Reminder sent to ${data.sent_to || "employee"}`),
    onError: (e) => toast.error(toApiError(e)),
  });

  const { data: deviceRequests = [] } = useQuery({
    queryKey: ["device-requests"],
    queryFn: async () => (await api.get("/employees/device-requests")).data,
    refetchInterval: 15000,
  });

  const decideDevice = useMutation({
    mutationFn: async ({ id, action }) => (await api.post(`/employees/device-requests/${id}/${action}`)).data,
    onSuccess: (_d, v) => {
      toast.success(v.action === "approve" ? "New device approved" : "Device request rejected");
      qc.invalidateQueries({ queryKey: ["device-requests"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(toApiError(e)),
  });

  const toggleLogout = useMutation({
    mutationFn: async ({ id, enabled }) => (await api.patch(`/employees/${id}`, { logout_enabled: enabled })).data,
    onSuccess: (d) => { toast.success(`Logout ${d.logout_enabled ? "enabled" : "locked"} for ${d.name}`); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const resetDevice = useMutation({
    mutationFn: async (id) => (await api.post(`/employees/${id}/reset-device`)).data,
    onSuccess: () => { toast.success("Device unbound — next login re-binds"); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const officeName = (id) => offices.find((o) => o.id === id)?.name || "—";

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">EMPLOYEES</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Team roster</h1>
        </div>
        {!editing && (
          <button onClick={() => setEditing({})} disabled={offices.length === 0} className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium px-4 py-2 text-sm inline-flex items-center gap-2 transition-colors" data-testid="new-emp-btn">
            <Plus size={14} /> New employee
          </button>
        )}
      </div>

      {offices.length === 0 && (
        <div className="border border-amber-500/30 bg-amber-500/10 p-4 mb-6 text-sm">
          <div className="mono text-xs uppercase tracking-widest text-amber-400 mb-1">NO OFFICES</div>
          Create at least one office first before adding employees.
        </div>
      )}

      {deviceRequests.length > 0 && (
        <div className="border border-amber-500/40 bg-amber-500/10 p-4 mb-6" data-testid="device-requests-banner">
          <div className="mono text-xs uppercase tracking-widest text-amber-400 mb-3 inline-flex items-center gap-2">
            <Smartphone size={13} /> {deviceRequests.length} new-device approval{deviceRequests.length === 1 ? "" : "s"} pending
          </div>
          <div className="space-y-2">
            {deviceRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 flex-wrap border border-white/10 bg-black/30 px-3 py-2" data-testid={`device-req-${r.id}`}>
                <div className="text-sm">
                  <span className="font-medium">{r.employee_name}</span>
                  <span className="text-gray-500 mono text-xs ml-2">{r.employee_email}</span>
                  <div className="text-[11px] text-gray-400 mono mt-0.5">
                    wants to use {r.model || r.platform || "a new device"} · <span className="text-gray-500">{r.device_id?.slice(0, 16)}…</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => decideDevice.mutate({ id: r.id, action: "approve" })} disabled={decideDevice.isPending}
                    data-testid={`device-approve-${r.id}`}
                    className="border border-green-500/40 hover:bg-green-500/10 text-green-400 px-3 py-1.5 text-xs uppercase tracking-widest font-mono inline-flex items-center gap-1.5">
                    <Check size={13} /> Approve
                  </button>
                  <button onClick={() => decideDevice.mutate({ id: r.id, action: "reject" })} disabled={decideDevice.isPending}
                    data-testid={`device-reject-${r.id}`}
                    className="border border-red-500/40 hover:bg-red-500/10 text-red-400 px-3 py-1.5 text-xs uppercase tracking-widest font-mono inline-flex items-center gap-1.5">
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing !== null && (
        <div className="mb-6">
          <EmployeeForm initial={editing?.id ? editing : null} offices={offices} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["employees"] }); }} />
        </div>
      )}

      <div className="surface" data-testid="employees-table">
        {isLoading && <div className="p-6 text-gray-500 mono text-xs uppercase tracking-widest">LOADING…</div>}
        {!isLoading && employees.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            <User size={24} className="mx-auto mb-3 text-gray-700" />
            No employees yet.
          </div>
        )}
        {employees.length > 0 && (
          <table className="w-full data-table">
            <thead><tr>
              <th>NAME</th><th>EMAIL</th><th>OFFICE</th><th>SCHEDULE</th><th>DEVICE</th><th className="text-right">ACTIONS</th>
            </tr></thead>
            <tbody>
              {employees.map((e, i) => (
                <tr key={e.id} className="stagger" style={{ animationDelay: `${i * 30}ms` }} data-testid={`emp-row-${e.id}`}>
                  <td className="font-medium">{e.name}</td>
                  <td className="mono text-gray-300">{e.email}</td>
                  <td className="text-gray-300">{officeName(e.office_id)}</td>
                  <td className="mono text-xs text-gray-300" data-testid={`emp-sched-${e.id}`}>{scheduleSummary(e.schedule)}</td>
                  <td className="mono text-xs" data-testid={`emp-device-${e.id}`}>
                    {e.bound_device_id ? (
                      <span className="inline-flex items-center gap-1 text-green-400"><Smartphone size={12} /> bound</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500"><Smartphone size={12} /> none</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex gap-2 flex-wrap justify-end">
                      <button
                        onClick={() => toggleLogout.mutate({ id: e.id, enabled: !e.logout_enabled })}
                        disabled={toggleLogout.isPending}
                        data-testid={`emp-logout-toggle-${e.id}`}
                        title={e.logout_enabled ? "Employee CAN sign out — click to lock" : "Sign out is LOCKED — click to allow"}
                        className={`border px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1 ${e.logout_enabled ? "border-green-500/30 hover:bg-green-500/10 text-green-400" : "border-white/10 hover:border-white/30 text-gray-400"}`}
                      >
                        {e.logout_enabled ? <LogOut size={12} /> : <Lock size={12} />} Logout {e.logout_enabled ? "ON" : "OFF"}
                      </button>
                      {e.bound_device_id && (
                        <button
                          onClick={() => { if (confirm(`Unbind ${e.name}'s device? Their next login on any phone will re-bind.`)) resetDevice.mutate(e.id); }}
                          disabled={resetDevice.isPending}
                          data-testid={`emp-reset-device-${e.id}`}
                          title="Unbind the current device (e.g. employee got a new phone)"
                          className="border border-white/10 hover:border-white/30 text-gray-300 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Smartphone size={12} /> Reset
                        </button>
                      )}
                      <button
                        onClick={() => challengeNow.mutate(e.id)}
                        disabled={challengeNow.isPending}
                        data-testid={`emp-selfie-${e.id}`}
                        title="Send an on-demand selfie challenge (requires the employee to be in an active session)"
                        className="border border-blue-500/30 hover:bg-blue-500/10 text-blue-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Camera size={12} /> Send selfie
                      </button>
                      <button
                        onClick={() => nudge.mutate({ userId: e.id, title: "Check-in reminder", body: `Please open StayPin and start your shift.` })}
                        disabled={nudge.isPending}
                        data-testid={`emp-nudge-${e.id}`}
                        title="Send a push notification to remind this employee to open the app"
                        className="border border-amber-500/30 hover:bg-amber-500/10 text-amber-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Bell size={12} /> Notify
                      </button>
                      <button onClick={() => setEditing(e)} className="border border-white/10 hover:border-white/30 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1" data-testid={`edit-emp-${e.id}`}>
                        <Edit3 size={12} /> Edit
                      </button>
                      <button onClick={() => { if (confirm(`Remove ${e.name}?`)) del.mutate(e.id); }}
                        className="border border-red-500/30 hover:bg-red-500/10 text-red-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1" data-testid={`delete-emp-${e.id}`}>
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
