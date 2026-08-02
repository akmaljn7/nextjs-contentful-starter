import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const ESRI_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTR = "Esri World Imagery";

function makeDivIcon(status = "completed", size = 14) {
  const cls = `pin-${status}`;
  return L.divIcon({
    className: "",
    html: `<div class="live-pin ${cls}" style="width:${size}px;height:${size}px"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Re-center the leaflet map when the `center` prop changes (react-leaflet doesn't do this by default). */
function RecenterOn({ center, zoom, animate = true }) {
  const map = useMap();
  useEffect(() => {
    if (!center || typeof center.lat !== "number" || typeof center.lng !== "number") return;
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate });
  }, [center?.lat, center?.lng, zoom, animate, map]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], points[0].zoom || 17, { animate: true });
      return;
    }
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(b, { padding: [40, 40], maxZoom: 18 });
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
  showZoom = true,
  fitAll = false,
  followCenter = true,
}) {
  // World-safe default (Africa-centered) when nothing else is available — no hardcoded NYC.
  const mapCenter = center || (offices[0] ? { lat: offices[0].lat, lng: offices[0].lng } : { lat: 9.0820, lng: 8.6753 });
  const initialZoom = center ? zoom : (offices[0] ? zoom : 3);

  const fitPoints = useMemo(() => {
    if (!fitAll) return null;
    const pts = [];
    offices.forEach((o) => pts.push({ lat: o.lat, lng: o.lng }));
    pins.forEach((p) => pts.push({ lat: p.lat, lng: p.lng }));
    return pts.length ? pts : null;
  }, [fitAll, offices, pins]);

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
        {fitPoints && <FitBounds points={fitPoints} />}
        {!fitPoints && followCenter && center && <RecenterOn center={center} zoom={zoom} />}
        {offices.map((o) => (
          <React.Fragment key={o.id}>
            <Circle
              center={[o.lat, o.lng]}
              radius={o.radius_meters}
              pathOptions={{ color: "#10b981", weight: 1.5, fillColor: "#10b981", fillOpacity: 0.08 }}
            />
            <Marker position={[o.lat, o.lng]} icon={makeDivIcon("completed", 12)}>
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
          <Circle
            center={[geofence.lat, geofence.lng]}
            radius={geofence.radius_m || geofence.radius_meters}
            pathOptions={{
              color: geofence.color || "#f59e0b",
              weight: 2,
              fillColor: geofence.color || "#f59e0b",
              fillOpacity: 0.1,
              dashArray: "6,4",
            }}
          />
        )}
        {pins.map((p, i) => (
          <Marker key={p.id || i} position={[p.lat, p.lng]} icon={makeDivIcon(p.status || "active", 14)}>
            <Popup>
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{p.label || "employee"}</div>
                {p.status && <div>status: {p.status}</div>}
                <div>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</div>
              </div>
            </Popup>
          </Marker>
        ))}
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
