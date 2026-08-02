import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { StatusChip } from "@/components/StatusChip";
import { useAuth } from "@/context/AuthContext";
import { fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, CalendarOff } from "lucide-react";

const STATUS_STYLE = {
  pending: { chip: "medium", label: "PENDING" },
  approved: { chip: "active", label: "APPROVED" },
  denied: { chip: "expired", label: "DENIED" },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function EmployeeView() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_date: todayIso(), end_date: todayIso(), reason: "" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["time-off-me"],
    queryFn: async () => (await api.get("/time-off/me")).data,
  });

  const create = useMutation({
    mutationFn: async () => (await api.post("/time-off", form)).data,
    onSuccess: () => {
      toast.success("Request submitted");
      setShowForm(false);
      setForm({ start_date: todayIso(), end_date: todayIso(), reason: "" });
      qc.invalidateQueries({ queryKey: ["time-off-me"] });
      qc.invalidateQueries({ queryKey: ["time-off-today"] });
    },
    onError: (e) => toast.error(toApiError(e)),
  });

  const cancel = useMutation({
    mutationFn: async (id) => (await api.delete(`/time-off/${id}`)).data,
    onSuccess: () => { toast.success("Request cancelled"); qc.invalidateQueries({ queryKey: ["time-off-me"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">TIME OFF</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">My requests</h1>
          <div className="text-xs text-gray-500 mono mt-1">SUBMIT · TRACK · CANCEL</div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            data-testid="new-request-btn"
            className="bg-white text-black hover:bg-gray-200 font-medium px-4 py-2 text-sm inline-flex items-center gap-2 transition-colors"
          >
            <Plus size={14} /> New request
          </button>
        )}
      </div>

      {showForm && (
        <div className="surface p-5 mb-6" data-testid="request-form">
          <div className="flex items-center justify-between mb-4">
            <div className="label-uppercase">NEW REQUEST</div>
            <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white transition-colors" data-testid="close-request-form"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-uppercase block mb-1.5">Start Date</label>
              <input type="date" min={todayIso()} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} data-testid="req-start" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
            </div>
            <div>
              <label className="label-uppercase block mb-1.5">End Date</label>
              <input type="date" min={form.start_date || todayIso()} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} data-testid="req-end" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
            </div>
            <div className="md:col-span-2">
              <label className="label-uppercase block mb-1.5">Reason</label>
              <textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="req-reason" placeholder="e.g., Medical appointment, family event, personal day" className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => create.mutate()} disabled={create.isPending || !form.reason.trim()} data-testid="req-submit" className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium px-4 py-2 text-sm transition-colors">{create.isPending ? "Submitting…" : "Submit request"}</button>
            <button onClick={() => setShowForm(false)} className="border border-white/10 hover:border-white/30 px-4 py-2 text-sm transition-colors" data-testid="req-cancel">Cancel</button>
          </div>
        </div>
      )}

      <div className="surface" data-testid="requests-list">
        {isLoading && <div className="p-6 text-gray-500 mono text-xs uppercase tracking-widest">LOADING…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            <CalendarOff size={24} className="mx-auto mb-3 text-gray-700" />
            No time-off requests yet.
          </div>
        )}
        {rows.length > 0 && (
          <table className="w-full data-table">
            <thead><tr>
              <th>START</th><th>END</th><th>REASON</th><th>STATUS</th><th>DECIDED BY</th><th>SUBMITTED</th><th className="text-right">ACTIONS</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="stagger" style={{ animationDelay: `${i * 30}ms` }} data-testid={`req-row-${r.id}`}>
                  <td className="mono">{r.start_date}</td>
                  <td className="mono">{r.end_date}</td>
                  <td className="text-gray-300 max-w-[240px]"><div className="truncate" title={r.reason}>{r.reason}</div></td>
                  <td><StatusChip status={STATUS_STYLE[r.status].chip} label={STATUS_STYLE[r.status].label} testId={`status-${r.id}`} /></td>
                  <td className="text-gray-400 text-xs">{r.decided_by_name || "—"}{r.decision_notes ? <div className="text-[10px] mono text-gray-500 truncate max-w-[180px]" title={r.decision_notes}>“{r.decision_notes}”</div> : null}</td>
                  <td className="mono text-[11px] text-gray-500">{fmtDateTime(r.created_at)}</td>
                  <td className="text-right">
                    {r.status === "pending" && (
                      <button onClick={() => { if (confirm("Cancel this request?")) cancel.mutate(r.id); }} className="border border-red-500/30 hover:bg-red-500/10 text-red-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1" data-testid={`cancel-${r.id}`}>
                        <Trash2 size={12} /> Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function AdminView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["time-off-all", filter],
    queryFn: async () => (await api.get(`/time-off${filter ? `?status=${filter}` : ""}`)).data,
  });

  const decide = useMutation({
    mutationFn: async ({ id, action }) => (await api.patch(`/time-off/${id}/${action}`, { notes: notes[id] || "" })).data,
    onSuccess: () => { toast.success("Decision saved"); qc.invalidateQueries({ queryKey: ["time-off-all"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const summary = useMemo(() => {
    return rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  }, [rows]);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">TIME OFF</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Requests</h1>
          <div className="text-xs text-gray-500 mono mt-1">APPROVE · DENY · OVERRIDE SCHEDULE</div>
        </div>
        <div className="flex gap-1" data-testid="filter-tabs">
          {[
            ["pending", `Pending${summary.pending ? ` (${summary.pending})` : ""}`],
            ["approved", "Approved"],
            ["denied", "Denied"],
            ["", "All"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              data-testid={`filter-${k || "all"}`}
              className={`text-[10px] mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                filter === k ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-white/10 hover:border-white/30 text-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="surface" data-testid="admin-requests">
        {isLoading && <div className="p-6 text-gray-500 mono text-xs uppercase tracking-widest">LOADING…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            <CalendarOff size={24} className="mx-auto mb-3 text-gray-700" />
            No requests {filter ? `with status "${filter}"` : ""}.
          </div>
        )}
        {rows.length > 0 && (
          <div className="divide-y divide-white/5">
            {rows.map((r, i) => (
              <div key={r.id} className="p-4 stagger" style={{ animationDelay: `${i * 30}ms` }} data-testid={`admin-req-${r.id}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="font-medium">{r.employee_name}</div>
                      <StatusChip status={STATUS_STYLE[r.status].chip} label={STATUS_STYLE[r.status].label} testId={`admin-status-${r.id}`} />
                    </div>
                    <div className="text-xs text-gray-500 mono">{r.employee_email}</div>
                    <div className="mt-2 mono text-sm">
                      <span className="text-white">{r.start_date}</span>
                      <span className="text-gray-500 mx-1.5">→</span>
                      <span className="text-white">{r.end_date}</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-300 max-w-2xl">{r.reason}</div>
                    {r.decision_notes && (
                      <div className="mt-2 text-xs text-gray-500 mono italic">Decision: &ldquo;{r.decision_notes}&rdquo; — {r.decided_by_name}</div>
                    )}
                    <div className="mt-2 text-[10px] text-gray-600 mono">submitted {fmtDateTime(r.created_at)}</div>
                  </div>
                  {r.status === "pending" && (
                    <div className="flex flex-col gap-2 min-w-[240px]">
                      <input
                        type="text"
                        placeholder="Decision note (optional)"
                        value={notes[r.id] || ""}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                        data-testid={`notes-${r.id}`}
                        className="bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-2.5 py-1.5 text-xs mono"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => decide.mutate({ id: r.id, action: "approve" })} data-testid={`approve-${r.id}`} className="flex-1 bg-green-500 text-black hover:bg-green-400 font-medium px-3 py-1.5 text-xs transition-colors inline-flex items-center justify-center gap-1"><Check size={12} /> Approve</button>
                        <button onClick={() => decide.mutate({ id: r.id, action: "deny" })} data-testid={`deny-${r.id}`} className="flex-1 border border-red-500/30 hover:bg-red-500/10 text-red-400 font-medium px-3 py-1.5 text-xs transition-colors inline-flex items-center justify-center gap-1"><X size={12} /> Deny</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function TimeOff() {
  const { user } = useAuth();
  const isAdmin = user?.role !== "employee";
  return (
    <AppShell>
      {isAdmin ? <AdminView /> : <EmployeeView />}
    </AppShell>
  );
}
