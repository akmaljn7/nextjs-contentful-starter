import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ScheduleEditor, scheduleSummary } from "@/components/ScheduleEditor";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, X, User } from "lucide-react";

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
              <th>NAME</th><th>EMAIL</th><th>OFFICE</th><th>SCHEDULE</th><th>CREATED</th><th className="text-right">ACTIONS</th>
            </tr></thead>
            <tbody>
              {employees.map((e, i) => (
                <tr key={e.id} className="stagger" style={{ animationDelay: `${i * 30}ms` }} data-testid={`emp-row-${e.id}`}>
                  <td className="font-medium">{e.name}</td>
                  <td className="mono text-gray-300">{e.email}</td>
                  <td className="text-gray-300">{officeName(e.office_id)}</td>
                  <td className="mono text-xs text-gray-300" data-testid={`emp-sched-${e.id}`}>{scheduleSummary(e.schedule)}</td>
                  <td className="mono text-gray-500 text-xs">{fmtDateTime(e.created_at)}</td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
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
