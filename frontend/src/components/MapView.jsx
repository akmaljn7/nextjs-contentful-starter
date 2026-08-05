import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { BACKEND } from "@/lib/api";

const ESRI_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTR = "Esri World Imagery";

const STATUS_COLOR = {
  active: "#10b981",
  paused: "#f59e0b",
  completed: "#3b82f6",
  expired: "#ef4444",
};

function initials(name) {
  if (!name) return "??";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

/** Colored circle + label (used when there is no photo). */
function makeDotIcon(status = "active", label = "", size = 14) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.completed;
  return L.divIcon({
    className: "",
    html: `
      <div class="employee-pin" data-status="${status}">
        ${label ? `<div class="employee-pin-label">${escapeHtml(label)}</div>` : ""}
        <div class="employee-pin-dot" style="background:${color};box-shadow:0 0 12px ${color}88"></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Circular photo pin with name label above and a status-colored ring. */
function makePhotoIcon(status = "active", label = "", photoUrl = "", size = 40) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.completed;
  const inits = initials(label);
  const inner = photoUrl
    ? `<img class="employee-pin-avatar-img" src="${photoUrl}" alt="" onerror="this.style.display='none';this.parentNode.querySelector('.employee-pin-initials').style.display='grid'"/>
       <div class="employee-pin-initials" style="display:none">${inits}</div>`
    : `<div class="employee-pin-initials" style="display:grid">${inits}</div>`;
  return L.divIcon({
    className: "",
    html: `
      <div class="employee-pin employee-pin-photo" data-status="${status}">
        ${label ? `<div class="employee-pin-label">${escapeHtml(label)}</div>` : ""}
        <div class="employee-pin-avatar" style="border-color:${color};box-shadow:0 0 16px ${color}66">
          ${inner}
        </div>
        <div class="employee-pin-pulse" style="border-color:${color}"></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2 + 6],
  });
}

/** Re-center the map when `center` changes. */
function RecenterOn({ center, zoom, animate = true }) {
  const map = useMap();
  useEffect(() => {
    if (!center || typeof center.lat !== "number" || typeof center.lng !== "number") return;
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate });
  }, [center?.lat, center?.lng, zoom, animate, map]);
  return null;
}

/** Fit the map on a specific point set (independent of the drawn markers). */
function FocusOn({ points }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!points || points.length === 0) return;
    const key = points.map((p) => `${p.id || ""}:${p.lat?.toFixed(3)},${p.lng?.toFixed(3)}`).join("|") + `#n=${points.length}`;
    if (key === lastKey.current) {
      if (points.length === 1) map.panTo([points[0].lat, points[0].lng], { animate: true, duration: 0.6 });
      return;
    }
    lastKey.current = key;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], points[0].zoom || 17, { animate: true });
    } else {
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(b, { padding: [60, 60], maxZoom: 17, animate: true });
    }
  }, [points, map]);
  return null;
}

export function MapView({
  height = 320,
  center,
  zoom = 15,
  offices = [],
  pins = [],
  geofence = null,
  onMapClick,
  onGeofenceDrag = null,
  showZoom = true,
  followCenter = true,
  focusPoints = null,
}) {
  const mapCenter = center || (offices[0] ? { lat: offices[0].lat, lng: offices[0].lng } : { lat: 9.0820, lng: 8.6753 });
  const initialZoom = center ? zoom : (offices[0] ? zoom : 3);
  const memoFocus = useMemo(() => (focusPoints && focusPoints.length ? focusPoints : null), [focusPoints]);

  return (
    <div style={{ height, width: "100%", position: "relative" }}>
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={initialZoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={showZoom}
        attributionControl={false}
        scrollWheelZoom={true}
        preferCanvas
      >
        <TileLayer url={ESRI_URL} attribution={ESRI_ATTR} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {memoFocus && <FocusOn points={memoFocus} />}
        {!memoFocus && followCenter && center && <RecenterOn center={center} zoom={zoom} />}
        {offices.map((o) => (
          <React.Fragment key={o.id}>
            <Circle
              center={[o.lat, o.lng]}
              radius={o.radius_meters}
              pathOptions={{ color: "#10b981", weight: 1.5, fillColor: "#10b981", fillOpacity: 0.08 }}
            />
            <Marker position={[o.lat, o.lng]} icon={makeDotIcon("completed", "", 12)}>
              <Popup>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{o.name}</div>
                  <div>{o.lat.toFixed(5)}, {o.lng.toFixed(5)}</div>
                  <div>radius: {o.radius_meters}m</div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}
        {geofence && (
          <>
            <Circle
              center={[geofence.lat, geofence.lng]}
              radius={geofence.radius_m || geofence.radius_meters}
              pathOptions={{
                color: geofence.color || "#f59e0b",
                weight: 2,
                fillColor: geofence.color || "#f59e0b",
                fillOpacity: 0.1,
                dashArray: onGeofenceDrag ? undefined : "6,4",
              }}
            />
            {onGeofenceDrag && (
              <Marker
                position={[geofence.lat, geofence.lng]}
                draggable
                icon={L.divIcon({
                  className: "",
                  html: `<div class="office-drag-pin" title="Drag to reposition"></div>`,
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                })}
                eventHandlers={{
                  dragend: (e) => {
                    const p = e.target.getLatLng();
                    onGeofenceDrag({ lat: p.lat, lng: p.lng });
                  },
                }}
              />
            )}
          </>
        )}
        {pins.map((p, i) => {
          const photoUrl = p.photo_url || (p.has_photo && p.id ? `${BACKEND}/api/photos/session/${p.id}` : "");
          const usePhoto = Boolean(p.has_photo || p.photo_url) && p.id !== "me";
          const icon = usePhoto
            ? makePhotoIcon(p.status || "active", p.label || "", photoUrl, 40)
            : makeDotIcon(p.status || "active", p.label || "", 14);
          return (
            <Marker key={p.id || i} position={[p.lat, p.lng]} icon={icon}>
              <Popup>
                <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{p.label || "employee"}</div>
                  {p.status && <div>status: {p.status}</div>}
                  <div>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function ClickHandler({ onClick }) {
  const map = useMap();
  useEffect(() => {
    const h = (e) => onClick(e.latlng);
    map.on("click", h);
    return () => map.off("click", h);
  }, [map, onClick]);
  return null;
}
