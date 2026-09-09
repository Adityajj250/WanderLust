import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { fetchRoadRoute } from "../api/api.js";

// ─── Custom divIcon factory ───────────────────────────────────────────────────
function createCustomIcon({ icon, label, className = "", isSelected = false }) {
  const selectedClass = isSelected ? "marker-selected" : "";
  const labelHtml = label ? `<span class="marker-label-pill">${label}</span>` : "";

  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="custom-marker-wrap ${selectedClass}">
        <div class="custom-marker-pin ${className}">
          <span class="custom-marker-icon">${icon}</span>
        </div>
        ${labelHtml}
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
  });
}

// ─── Re-centers the map when the coordinates change ────────────────────────────
function Recenter({ lat, lon, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === "number" && typeof lon === "number") {
      map.setView([lat, lon], zoom || map.getZoom(), { animate: true });
    }
  }, [lat, lon, zoom, map]);
  return null;
}

// ─── RoadPath: fetches single real road geometry from OSRM then draws it ────────
function RoadPath({ from, to, color = "#1e6f5c", weight = 4, tooltip, distText }) {
  const [positions, setPositions] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!from || !to || !from[0] || !to[0]) return;

    fetchRoadRoute(from[0], from[1], to[0], to[1]).then((road) => {
      if (cancelled) return;
      if (road && road.length >= 2) {
        setPositions(road);
      } else {
        // Straight line fallback
        setPositions([from, to]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [from?.[0], from?.[1], to?.[0], to?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!positions) return null;

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }}
    >
      <Tooltip sticky>
        <div>
          {tooltip}
          {distText && <div className="route-tooltip-dist">🚗 Distance: {distText}</div>}
        </div>
      </Tooltip>
    </Polyline>
  );
}

export default function MapView({
  center,
  zoom = 13,
  attractions = [],
  hotels = [],
  transportHubs = [],
  activeLayer = "all", // 'all' | 'attractions' | 'hotels' | 'transport'
  selectedHotel = null,
  selectedAttraction = null,
  arrivalPoint = null,
  activeRoute = null, // { from: [lat, lon], to: [lat, lon], label: "..." }
  onSelectHotel,
  onSelectAttraction,
  onSelectTransportHub,
}) {
  if (!center) return null;

  const showCenter = activeLayer === "all";
  const showAttractions = activeLayer === "all" || activeLayer === "attractions";
  const showHotels = activeLayer === "all" || activeLayer === "hotels";
  const showTransport = activeLayer === "all" || activeLayer === "transport";

  // Active target for map re-centering
  const focusLat = selectedHotel?.lat || selectedAttraction?.lat || arrivalPoint?.lat || center.lat;
  const focusLon = selectedHotel?.lon || selectedAttraction?.lon || arrivalPoint?.lon || center.lon;

  const selectedHotelKey = selectedHotel?._id || selectedHotel?.osmId || selectedHotel?.name;
  const selectedAttractionKey = selectedAttraction?._id || selectedAttraction?.osmId || selectedAttraction?.name;

  return (
    <div className="map-view-wrapper">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={zoom}
        className="map-container"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={focusLat} lon={focusLon} />

        {/* Destination Center Marker */}
        {showCenter && (
          <Marker
            position={[center.lat, center.lon]}
            icon={createCustomIcon({ icon: "🎯", label: "Center", className: "marker-center" })}
          >
            <Popup>
              <div className="map-popup-card">
                <strong>{center.displayName?.split(",")[0] || "Destination"}</strong>
                <p className="popup-sub">Destination Center</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* ── Arrival Point Pin ──────────────────────────────────────────────── */}
        {arrivalPoint && (
          <Marker
            position={[arrivalPoint.lat, arrivalPoint.lon]}
            icon={createCustomIcon({
              icon:
                arrivalPoint.type === "Airport"
                  ? "✈️"
                  : arrivalPoint.type === "Railway Station"
                  ? "🚆"
                  : arrivalPoint.type === "Bus Station"
                  ? "🚌"
                  : "🚗",
              label: "Arrival",
              className: "marker-arrival-point",
              isSelected: true,
            })}
          >
            <Popup>
              <div className="map-popup-card">
                <strong>{arrivalPoint.name}</strong>
                <span className="badge hub-badge">📍 {arrivalPoint.type}</span>
                <p className="popup-sub">Your arrival point into the city</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* ── CLEAN ROUTE DRAWING (Only when explicitly active) ─────────────── */}
        {/* 1. Explicit Active Route (e.g. In Transport Step between Arrival & Hotel) */}
        {activeRoute && activeRoute.from && activeRoute.to && (
          <RoadPath
            from={activeRoute.from}
            to={activeRoute.to}
            color="#e67e22"
            weight={5}
            tooltip={activeRoute.label}
            distText={activeRoute.distText}
          />
        )}

        {/* 2. When a specific hotel and a specific attraction are focused */}
        {!activeRoute && selectedHotel && selectedAttraction && (
          <RoadPath
            from={[selectedHotel.lat, selectedHotel.lon]}
            to={[selectedAttraction.lat, selectedAttraction.lon]}
            color="#1e6f5c"
            weight={4.5}
            tooltip={
              <>
                <strong>{selectedHotel.name}</strong> ➔ <strong>{selectedAttraction.name}</strong>
              </>
            }
          />
        )}

        {/* ── Tourist Attractions Markers ──────────────────────────────────── */}
        {showAttractions &&
          attractions.map((a) => {
            const isSelected = (a._id || a.osmId || a.name) === selectedAttractionKey;
            return (
              <Marker
                key={a._id || a.osmId || a.name}
                position={[a.lat, a.lon]}
                icon={createCustomIcon({
                  icon: "🏛️",
                  label: a.category || "Sight",
                  className: "marker-tourism",
                  isSelected,
                })}
                eventHandlers={{
                  click: () => onSelectAttraction && onSelectAttraction(a),
                }}
              >
                <Popup>
                  <div className="map-popup-card">
                    <strong>{a.name}</strong>
                    <span className="badge">{a.category}</span>
                    <p className="popup-desc">{a.description}</p>
                    {onSelectAttraction && (
                      <button
                        type="button"
                        className="secondary small popup-btn"
                        onClick={() => onSelectAttraction(a)}
                      >
                        Inspect Sight
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* ── Hotels Markers ───────────────────────────────────────────────── */}
        {showHotels &&
          hotels.map((h) => {
            const isSelected = (h._id || h.osmId || h.name) === selectedHotelKey;

            return (
              <Marker
                key={h._id || h.osmId || h.name}
                position={[h.lat, h.lon]}
                icon={createCustomIcon({
                  icon: "🏨",
                  label: `₹${h.pricePerNight ? Math.round(h.pricePerNight) : ""}`,
                  className: "marker-hotel",
                  isSelected,
                })}
                eventHandlers={{
                  click: () => onSelectHotel && onSelectHotel(h),
                }}
              >
                <Popup>
                  <div className="map-popup-card">
                    <strong>{h.name}</strong>
                    <div className="popup-rating-price">
                      <span>⭐ {h.rating}</span>
                      <span>·</span>
                      <span>₹{h.pricePerNight}/night</span>
                    </div>
                    {h.locationScore && (
                      <div className="popup-score-pill">
                        Location Score: <strong>{h.locationScore}/100</strong>
                      </div>
                    )}
                    <p className="popup-address">{h.address}</p>
                    <button
                      type="button"
                      className="primary small popup-btn"
                      onClick={() => onSelectHotel && onSelectHotel(h)}
                    >
                      {isSelected ? "Selected Stay ✓" : "Choose Hotel"}
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* ── Transportation Hub Markers ───────────────────────────────────── */}
        {showTransport &&
          transportHubs.map((hub) => {
            let icon = "🚌";
            let className = "marker-transport-bus";
            if (hub.type === "Airport") {
              icon = "✈️";
              className = "marker-transport-airport";
            } else if (hub.type === "Railway Station") {
              icon = "🚆";
              className = "marker-transport-railway";
            }

            return (
              <Marker
                key={hub._id || hub.osmId || hub.name}
                position={[hub.lat, hub.lon]}
                icon={createCustomIcon({ icon, label: hub.type, className })}
                eventHandlers={{
                  click: () => onSelectTransportHub && onSelectTransportHub(hub),
                }}
              >
                <Popup>
                  <div className="map-popup-card">
                    <strong>{hub.name}</strong>
                    <span className="badge hub-badge">
                      {icon} {hub.type}
                    </span>
                    {hub.operator && <p className="popup-operator">Operator: {hub.operator}</p>}
                    <button
                      type="button"
                      className="secondary small popup-btn"
                      onClick={() => onSelectTransportHub && onSelectTransportHub(hub)}
                    >
                      Set as Arrival Point
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
    </div>
  );
}
