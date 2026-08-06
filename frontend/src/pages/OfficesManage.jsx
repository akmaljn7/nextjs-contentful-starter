import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, toApiError } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { MapView } from "@/components/MapView";
import { fmtCoord } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Edit3, X, Crosshair } from "lucide-react";

function OfficeForm({ initial, onCancel, onSaved }) {
  const [form, setForm] = useState(initial || { name: "", lat: "", lng: "", radius_meters: 150 });
  const [locating, setLocating] = useState(false);
  // Fallback center when neither the browser nor the admin has picked a spot.
  // Using a neutral world center so the map isn't stuck on New York or empty.
  const FALLBACK = { lat: 9.0820, lng: 8.6753 };

  // Auto-fill new-office form with the browser's current location once. If
  // geolocation is denied or times out, drop a draggable pin at the fallback
  // center so the admin can always start dragging without needing to click
  // the map first.
  useEffect(() => {
    if (initial || form.lat !== "") return;
    let settled = false;
    const drop = () => {
      if (!settled) {
        settled = true;
        setForm((f) => (f.lat === "" ? { ...f, lat: FALLBACK.lat, lng: FALLBACK.lng } : f));
      }
    };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (!settled) {
            settled = true;
            setForm((f) => (f.lat === "" ? { ...f, lat: p.coords.latitude, lng: p.coords.longitude } : f));
          }
        },
        drop,
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
      );
      // Safety fallback if the callback never fires
      const t = setTimeout(drop, 6500);
      return () => clearTimeout(t);
    }
    drop();
  }, [initial, form.lat]);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) { toast.error("Geolocation not supported in this browser"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, lat: p.coords.latitude, lng: p.coords.longitude }));
        setLocating(false);
        toast.success(`Locked ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`);
      },
      (e) => { setLocating(false); toast.error(e.message || "Location denied"); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = { name: form.name, lat: Number(form.lat), lng: Number(form.lng), radius_meters: Number(form.radius_meters) };
      if (initial?.id) return (await api.patch(`/offices/${initial.id}`, body)).data;
      return (await api.post("/offices", body)).data;
    },
    onSuccess: () => { toast.success(initial ? "Office updated" : "Office created"); onSaved(); },
    onError: (e) => toast.error(toApiError(e)),
  });

  const pickCenter = (latlng) => setForm((f) => ({ ...f, lat: latlng.lat, lng: latlng.lng }));
  const centerObj = form.lat !== "" && form.lng !== "" && !Number.isNaN(Number(form.lat)) && !Number.isNaN(Number(form.lng))
    ? { lat: Number(form.lat), lng: Number(form.lng) } : null;
  // Freeze the map viewport unless there is a big jump. Small drag moves must
  // NOT re-fly the map or the pin appears to jitter under the cursor. Big
  // jumps (Use my location, editing a different office) DO re-fly.
  const [mapAnchor, setMapAnchor] = useState(centerObj);
  useEffect(() => {
    if (!centerObj) return;
    if (!mapAnchor) { setMapAnchor(centerObj); return; }
    const dLat = Math.abs(centerObj.lat - mapAnchor.lat);
    const dLng = Math.abs(centerObj.lng - mapAnchor.lng);
    if (dLat > 0.005 || dLng > 0.005) setMapAnchor(centerObj);
  }, [centerObj?.lat, centerObj?.lng, mapAnchor]);

  return (
    <div className="surface p-5" data-testid="office-form">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="label-uppercase">{initial ? "EDIT OFFICE" : "NEW OFFICE"}</div>
          <div className="text-sm text-gray-400 mt-0.5">Click the map, or tap &ldquo;Use my current location&rdquo;, to place the geofence center.</div>
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors" data-testid="close-form"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <label className="label-uppercase block mb-1.5">Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="office-name"
              className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            data-testid="use-my-location"
            className="w-full border border-green-500/40 hover:bg-green-500/10 text-green-400 px-3 py-2 text-xs mono uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Crosshair size={13} strokeWidth={1.75} />
            {locating ? "Locating…" : "Use my current location"}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-uppercase block mb-1.5">Latitude</label>
              <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })}
                data-testid="office-lat"
                placeholder="e.g. 6.5244"
                className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
            </div>
            <div>
              <label className="label-uppercase block mb-1.5">Longitude</label>
              <input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })}
                data-testid="office-lng"
                placeholder="e.g. 3.3792"
                className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
            </div>
          </div>
          <div>
            <label className="label-uppercase block mb-1.5">Radius (meters)</label>
            <input type="number" min={10} max={5000} value={form.radius_meters}
              onChange={(e) => setForm({ ...form, radius_meters: e.target.value })}
              data-testid="office-radius"
              className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/30 focus:outline-none px-3 py-2 text-sm mono" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => save.mutate()} disabled={save.isPending || !form.name || form.lat === "" || form.lng === ""}
              data-testid="office-save"
              className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-medium px-4 py-2 text-sm transition-colors">
              {save.isPending ? "Saving…" : (initial ? "Save changes" : "Create office")}
            </button>
            <button onClick={onCancel} className="border border-white/10 hover:border-white/30 px-4 py-2 text-sm transition-colors" data-testid="office-cancel">Cancel</button>
          </div>
        </div>
        <div className="min-h-[280px]">
          <MapView
            height={360}
            center={mapAnchor || centerObj}
            zoom={17}
            followCenter={true}
            geofence={centerObj ? { lat: centerObj.lat, lng: centerObj.lng, radius_m: Number(form.radius_meters) || 150, color: "#10b981" } : null}
            onMapClick={pickCenter}
            onGeofenceDrag={pickCenter}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[10px] mono uppercase tracking-widest text-gray-500" data-testid="pin-hint">
              {centerObj ? "DRAG THE GREEN PIN TO REPOSITION · CLICK MAP TO JUMP" : "TAP \"USE MY CURRENT LOCATION\" OR CLICK THE MAP"}
            </div>
            {centerObj && (
              <div className="text-[10px] mono text-green-400 tabular-nums" data-testid="pin-coords">
                {Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfficesManage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | {} for new | office for edit
  const { data: offices = [], isLoading } = useQuery({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/offices/${id}`)).data,
    onSuccess: () => { toast.success("Office deleted"); qc.invalidateQueries({ queryKey: ["offices"] }); },
    onError: (e) => toast.error(toApiError(e)),
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="label-uppercase">OFFICES</div>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">Geofence sites</h1>
        </div>
        {!editing && (
          <button onClick={() => setEditing({})} className="bg-white text-black hover:bg-gray-200 font-medium px-4 py-2 text-sm inline-flex items-center gap-2 transition-colors" data-testid="new-office-btn">
            <Plus size={14} /> New office
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-6">
          <OfficeForm
            initial={editing?.id ? editing : null}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["offices"] }); }}
          />
        </div>
      )}

      <div className="surface" data-testid="offices-table">
        {isLoading && <div className="p-6 text-gray-500 mono text-xs uppercase tracking-widest">LOADING…</div>}
        {!isLoading && offices.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            <MapPin size={24} className="mx-auto mb-3 text-gray-700" />
            No offices yet. Click &quot;New office&quot; to create your first geofence.
          </div>
        )}
        {offices.length > 0 && (
          <table className="w-full data-table">
            <thead><tr>
              <th>NAME</th><th>LAT</th><th>LNG</th><th>RADIUS</th><th className="text-right">ACTIONS</th>
            </tr></thead>
            <tbody>
              {offices.map((o, i) => (
                <tr key={o.id} className="stagger" style={{ animationDelay: `${i * 30}ms` }} data-testid={`office-row-${o.id}`}>
                  <td className="font-medium">{o.name}</td>
                  <td className="mono text-gray-300">{fmtCoord(o.lat)}</td>
                  <td className="mono text-gray-300">{fmtCoord(o.lng)}</td>
                  <td className="mono text-gray-300">{o.radius_meters} m</td>
                  <td className="text-right">
                    <div className="inline-flex gap-2">
                      <button onClick={() => setEditing(o)} className="border border-white/10 hover:border-white/30 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1" data-testid={`edit-office-${o.id}`}>
                        <Edit3 size={12} /> Edit
                      </button>
                      <button onClick={() => { if (confirm(`Delete "${o.name}"?`)) del.mutate(o.id); }}
                        className="border border-red-500/30 hover:bg-red-500/10 text-red-400 px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1" data-testid={`delete-office-${o.id}`}>
                        <Trash2 size={12} /> Delete
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
