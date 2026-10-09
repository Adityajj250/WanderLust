import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { fetchRoadRoute } from "../api/api.js";

// ─── Custom divIcon factory ──────────────────────────────────────────────────
// distLabel renders as a small pill directly below the name, part of the marker
// element — so it stays glued to the pin at every zoom level.
function createCustomIcon({ icon, label, distLabel = null, className = "", isSelected = false }) {
  const selectedClass = isSelected ? "marker-selected" : "";
  const namePill = label ? `<span class="marker-label-pill">${label}</span>` : "";
  const distPill = distLabel ? `<span class="marker-dist-pill">${distLabel}</span>` : "";
  return L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="custom-marker-wrap ${selectedClass}">
        <div class="custom-marker-pin ${className}">
          <span class="custom-marker-icon">${icon}</span>
        </div>
        ${namePill}
        ${distPill}
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
  });
}

// ─── Re-centers the map ───────────────────────────────────────────────────────
function Recenter({ lat, lon, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === "number" && typeof lon === "number") {
      map.setView([lat, lon], zoom || map.getZoom(), { animate: true });
    }
  }, [lat, lon, zoom, map]);
  return null;
}

// ─── Fit map to a bounding box ────────────────────────────────────────────────
function FitBounds({ points, fitKey }) {
  const map = useMap();
  useEffect(() => {
    const valid = (points || []).filter((p) => p && typeof p[0] === "number" && typeof p[1] === "number");
    if (valid.length === 0) return;
    if (valid.length === 1) { map.setView(valid[0], 14, { animate: true }); return; }
    map.fitBounds(valid, { padding: [60, 60], animate: true, maxZoom: 15 });
  }, [fitKey, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function approxKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const keyOf = (x) => x._id || x.osmId || x.name;

// Full mesh: every sight connected to every other sight (deduped by sorted pair key)
function buildSightMeshLinks(sights) {
  const seen = new Set(), links = [];
  sights.forEach((a) => {
    sights.forEach((b) => {
      if (keyOf(b) === keyOf(a)) return;
      const pair = [keyOf(a), keyOf(b)].sort().join("||");
      if (seen.has(pair)) return;
      seen.add(pair);
      links.push({ a, b, pair });
    });
  });
  return links;
}

function formatDist(metres) {
  if (!metres || metres <= 0) return null;
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

// ─── RoadPath: fetches road geometry, draws the line, reports resolved distance
// back via onDistResolved(distString). No floating badge — distance is owned by
// the destination marker so it never drifts with zoom.
function RoadPath({ from, to, color = "#1e6f5c", weight = 4, tooltip, distText, onDistResolved }) {
  const [positions, setPositions] = useState(null);
  const [roadDist, setRoadDist] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!from || !to || !from[0] || !to[0]) return;
    fetchRoadRoute(from[0], from[1], to[0], to[1]).then((road) => {
      if (cancelled) return;
      if (road?.coords?.length >= 2) {
        setPositions(road.coords);
        setRoadDist(road.distanceM);
      } else {
        setPositions([from, to]);
        setRoadDist(null);
      }
    });
    return () => { cancelled = true; };
  }, [from?.[0], from?.[1], to?.[0], to?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire callback whenever the resolved distance string changes
  useEffect(() => {
    if (!onDistResolved) return;
    const dist = distText || (roadDist ? formatDist(roadDist) : null);
    onDistResolved(dist);
  }, [roadDist, distText]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!positions) return null;

  const displayDist = distText || (roadDist ? formatDist(roadDist) : null);

  return (
    <Polyline
      positions={positions}
      pathOptions={{ color, weight, opacity: 0.85, lineCap: "round", lineJoin: "round" }}
    >
      <Tooltip sticky>
        <div>
          {tooltip}
          {displayDist && <div className="route-tooltip-dist">🚗 {displayDist}</div>}
        </div>
      </Tooltip>
    </Polyline>
  );
}

// ─── Hub → Hotels: one route per hotel, distances reported back via state ─────
function HubToHotelsRoutes({ hub, hotels, onDistances }) {
  // distMap: { hotelKey → distString }
  const [distMap, setDistMap] = useState({});

  // Reset when hub changes
  useEffect(() => { setDistMap({}); }, [hub?.lat, hub?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDistances?.(distMap);
  }, [distMap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hub || !hotels?.length) return null;
  return hotels.map((hotel) => (
    <RoadPath
      key={`hub-hotel-${keyOf(hotel)}`}
      from={[hub.lat, hub.lon]}
      to={[hotel.lat, hotel.lon]}
      color="#7c3aed"
      weight={3.5}
      tooltip={<><strong>{hub.name}</strong> ➔ <strong>{hotel.name}</strong></>}
      onDistResolved={(dist) =>
        setDistMap((prev) => {
          const k = keyOf(hotel);
          if (prev[k] === dist) return prev;
          return { ...prev, [k]: dist };
        })
      }
    />
  ));
}

// ─── Hotel → Attractions: distances reported back per attraction ──────────────
function HotelToAttractionsRoutes({ hotel, attractions, onDistances }) {
  const [distMap, setDistMap] = useState({});

  useEffect(() => { setDistMap({}); }, [hotel?.lat, hotel?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDistances?.(distMap);
  }, [distMap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hotel || !attractions?.length) return null;
  return attractions.map((attraction) => (
    <RoadPath
      key={`hotel-sight-${keyOf(attraction)}`}
      from={[hotel.lat, hotel.lon]}
      to={[attraction.lat, attraction.lon]}
      color="#0d9488"
      weight={3.5}
      tooltip={<><strong>{hotel.name}</strong> ➔ <strong>{attraction.name}</strong></>}
      onDistResolved={(dist) =>
        setDistMap((prev) => {
          const k = keyOf(attraction);
          if (prev[k] === dist) return prev;
          return { ...prev, [k]: dist };
        })
      }
    />
  ));
}

// ─── Attractions chain: distances reported back per attraction ────────────────
function AttractionChainRoutes({ attractions, onDistances }) {
  const [distMap, setDistMap] = useState({});

  useEffect(() => { setDistMap({}); }, [attractions?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onDistances?.(distMap);
  }, [distMap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!attractions || attractions.length < 2) return null;
  return attractions.slice(0, -1).map((a, i) => {
    const b = attractions[i + 1];
    return (
      <RoadPath
        key={`sight-chain-${keyOf(a)}-${keyOf(b)}`}
        from={[a.lat, a.lon]}
        to={[b.lat, b.lon]}
        color="#f59e0b"
        weight={3}
        tooltip={<><strong>{a.name}</strong> ↔ <strong>{b.name}</strong></>}
        onDistResolved={(dist) =>
          setDistMap((prev) => {
            const k = keyOf(a);
            if (prev[k] === dist) return prev;
            return { ...prev, [k]: dist };
          })
        }
      />
    );
  });
}

// ─── Main MapView export ──────────────────────────────────────────────────────
export default function MapView({
  center,
  zoom = 13,
  attractions = [],
  hotels = [],
  allHotels = null,
  allAttractions = null,
  selectedAttractionsList = [],
  transportHubs = [],
  activeLayer = "all",
  selectedHotel = null,
  selectedAttraction = null,
  selectedTransportHub = null,
  arrivalPoint = null,
  activeRoute = null,
  transitRoute = null,
  hotelDistances = [],          // [{ name, distanceKm }] — distances from selected hotel to attractions
  hubToHotelDistances = [],     // [{ name, distanceKm }] — distances from selected hub to hotels
  fullTrip = null,
  onSelectHotel,
  onSelectAttraction,
  onSelectTransportHub,
  onClearMap,                   // callback: reset all selections → neutral state
}) {
  // Per-marker resolved road distances, updated as OSRM responds
  const [hotelRouteDistMap,      setHotelRouteDistMap]      = useState({});
  const [attractionRouteDistMap, setAttractionRouteDistMap] = useState({});
  const [chainRouteDistMap,      setChainRouteDistMap]      = useState({});

  if (!center) return null;

  const enabledLayers = Array.isArray(activeLayer) ? activeLayer : ["attractions", "hotels", "transport"];
  const showAttractions = enabledLayers.includes("attractions");
  const showHotels      = enabledLayers.includes("hotels");
  const showTransport   = enabledLayers.includes("transport");

  const focusLat = selectedHotel?.lat || selectedAttraction?.lat || arrivalPoint?.lat || center.lat;
  const focusLon = selectedHotel?.lon || selectedAttraction?.lon || arrivalPoint?.lon || center.lon;

  // Full trip view
  const fullTripSights   = fullTrip?.attractions || [];
  const neighbourLinks   = fullTrip ? buildSightMeshLinks(fullTripSights) : [];
  const fitPoints = fullTrip
    ? [...(fullTrip.hotel ? [[fullTrip.hotel.lat, fullTrip.hotel.lon]] : []), ...fullTripSights.map((a) => [a.lat, a.lon])]
    : [];
  const fitKey = fullTrip
    ? [fullTrip.hotel && keyOf(fullTrip.hotel), ...fullTripSights.map(keyOf)].join("|")
    : "";

  const selectedHotelKey      = keyOf(selectedHotel || {});
  const selectedAttractionKey = keyOf(selectedAttraction || {});
  const selectedHubKey        = keyOf(selectedTransportHub || {});

  // Fit bounds priority: fullTrip > hub > hotel > default recenter
  const hubFitPoints = selectedTransportHub && !selectedHotel && (allHotels || hotels).length > 0
    ? [[selectedTransportHub.lat, selectedTransportHub.lon], ...(allHotels || hotels).map((h) => [h.lat, h.lon])]
    : null;
  const hotelFitPoints = selectedHotel && (allAttractions || attractions).length > 0
    ? [[selectedHotel.lat, selectedHotel.lon], ...(allAttractions || attractions).map((a) => [a.lat, a.lon])]
    : null;

  let activeFitPoints = null, activeFitKey = "";
  if (fullTrip)           { activeFitPoints = fitPoints;      activeFitKey = fitKey; }
  else if (hubFitPoints)  { activeFitPoints = hubFitPoints;   activeFitKey = selectedHubKey; }
  else if (hotelFitPoints){ activeFitPoints = hotelFitPoints; activeFitKey = selectedHotelKey; }

  // Is the map currently showing any routes / distances?
  const hasActiveRoutes = !!(
    selectedHotel || selectedTransportHub ||
    (selectedAttractionsList.length >= 2 && !selectedHotel) ||
    activeRoute || transitRoute
  );

  // Distance label resolvers — road distance takes priority over the
  // pre-computed hotelDistances/hubToHotelDistances props
  const getAttractionDistLabel = (attraction) => {
    const k = keyOf(attraction);
    if (selectedHotel) {
      // Road distance from the route components (arrives async)
      if (attractionRouteDistMap[k]) return attractionRouteDistMap[k];
      // Fallback: pre-computed backend distance
      const d = hotelDistances.find((x) => x.name === attraction.name || x.id === k);
      return d?.distanceKm != null ? `${d.distanceKm} km` : null;
    }
    // Chain mode: road distance if available, else straight-line approx
    return chainRouteDistMap[k] || null;
  };

  const getHotelDistLabel = (hotel) => {
    if (!selectedTransportHub || selectedHotel) return null;
    const k = keyOf(hotel);
    if (hotelRouteDistMap[k]) return hotelRouteDistMap[k];
    const d = hubToHotelDistances.find((x) => x.name === hotel.name || x.id === k);
    return d?.distanceKm != null ? `${d.distanceKm} km` : null;
  };

  return (
    <div className="map-view-wrapper map-always-light">
      {/* Clear Map button — top-right corner, outside the MapContainer */}
      {hasActiveRoutes && onClearMap && (
        <button
          type="button"
          className="map-clear-btn"
          title="Remove all routes and distances"
          onClick={onClearMap}
        >
          ✕ Clear Map
        </button>
      )}

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

        {activeFitPoints
          ? <FitBounds points={activeFitPoints} fitKey={activeFitKey} />
          : <Recenter lat={focusLat} lon={focusLon} />
        }

        {/* ── Destination Center Marker ─────────────────────────────────── */}
        {!fullTrip && (
          <Marker
            position={[center.lat, center.lon]}
            icon={createCustomIcon({
              icon: "🎯",
              label: center.displayName?.split(",")[0] || center.query || "Destination",
              className: "marker-center",
            })}
          >
            <Popup>
              <div className="map-popup-card">
                <strong>{center.displayName?.split(",")[0] || "Destination"}</strong>
                <p className="popup-sub">Destination Center</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* ── Arrival Point Pin ─────────────────────────────────────────── */}
        {arrivalPoint && !fullTrip && (
          <Marker
            position={[arrivalPoint.lat, arrivalPoint.lon]}
            icon={createCustomIcon({
              icon: arrivalPoint.type === "Airport" ? "✈️"
                  : arrivalPoint.type === "Railway Station" ? "🚆"
                  : arrivalPoint.type === "Bus Station" ? "🚌" : "🚗",
              label: arrivalPoint.name,
              className: "marker-arrival-point",
              isSelected: true,
            })}
          >
            <Popup>
              <div className="map-popup-card">
                <strong>{arrivalPoint.name}</strong>
                <span className="badge hub-badge">📍 {arrivalPoint.type}</span>
                <p className="popup-sub">Your arrival point</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* ── Wizard active route (terminal → hotel) ──────────────────────── */}
        {activeRoute?.from && activeRoute?.to && (
          <RoadPath
            from={activeRoute.from} to={activeRoute.to}
            color="#e67e22" weight={5}
            tooltip={activeRoute.label}
            distText={activeRoute.distText}
          />
        )}

        {/* ── Transit route ────────────────────────────────────────────────── */}
        {transitRoute?.from && transitRoute?.to && (
          <RoadPath
            from={transitRoute.from} to={transitRoute.to}
            color="#2563eb" weight={4.5}
            tooltip={transitRoute.label}
            distText={transitRoute.distText}
          />
        )}

        {/* ── Full Trip View ───────────────────────────────────────────────── */}
        {fullTrip?.hotel && fullTripSights.map((a) => (
          <RoadPath
            key={`full-hotel-${keyOf(a)}`}
            from={[fullTrip.hotel.lat, fullTrip.hotel.lon]}
            to={[a.lat, a.lon]}
            color="#1e6f5c" weight={4}
            tooltip={<><strong>{fullTrip.hotel.name}</strong> ➔ <strong>{a.name}</strong></>}
          />
        ))}
        {neighbourLinks.map(({ a, b, pair }) => (
          <RoadPath
            key={`full-nb-${pair}`}
            from={[a.lat, a.lon]} to={[b.lat, b.lon]}
            color="#7c3aed" weight={3}
            tooltip={<><strong>{a.name}</strong> ↔ <strong>{b.name}</strong></>}
          />
        ))}

        {/* ── Hub → All Hotels — distances bubble up into hotelRouteDistMap ──
            Routes vanish automatically once a hotel is selected.              */}
        {selectedTransportHub && !selectedHotel && !fullTrip && (
          <HubToHotelsRoutes
            hub={selectedTransportHub}
            hotels={allHotels || hotels}
            onDistances={setHotelRouteDistMap}
          />
        )}

        {/* ── Hotel → All Attractions — distances bubble up ────────────────── */}
        {selectedHotel && !fullTrip && (
          <HotelToAttractionsRoutes
            hotel={selectedHotel}
            attractions={allAttractions || attractions}
            onDistances={setAttractionRouteDistMap}
          />
        )}

        {/* ── Selected Attractions chain — distances bubble up ─────────────
            Vanishes once a hotel is selected.                                 */}
        {!fullTrip && !selectedHotel && selectedAttractionsList.length >= 2 && (
          <AttractionChainRoutes
            attractions={selectedAttractionsList}
            onDistances={setChainRouteDistMap}
          />
        )}

        {/* ── Tourist Attraction Markers ─────────────────────────────────── */}
        {showAttractions && attractions.map((a) => {
          const isSelected = keyOf(a) === selectedAttractionKey;
          const distLabel   = getAttractionDistLabel(a);
          const distContext = selectedHotel ? "from hotel" : "to next";
          return (
            <Marker
              key={keyOf(a)}
              position={[a.lat, a.lon]}
              icon={createCustomIcon({
                icon: a.icon || "🏛️",
                label: a.name,
                distLabel,
                className: "marker-tourism",
                isSelected,
              })}
              eventHandlers={{ click: () => onSelectAttraction?.(a) }}
            >
              <Popup>
                <div className="map-popup-card">
                  <strong>{a.name}</strong>
                  <span className="badge">{a.category}</span>
                  {distLabel && <div className="popup-dist-line">{distLabel} {distContext}</div>}
                  <p className="popup-desc">{a.description}</p>
                  <div className="popup-actions-row">
                    <a
                      className="know-more-btn"
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${a.name} tourist attraction reviews photos`)}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      🔍 Know more
                    </a>
                    {onSelectAttraction && (
                      <button type="button" className="secondary small popup-btn" onClick={() => onSelectAttraction(a)}>
                        Inspect Sight
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Hotel Markers ─────────────────────────────────────────────── */}
        {showHotels && hotels.map((h) => {
          const isSelected = keyOf(h) === selectedHotelKey;
          const distLabel  = getHotelDistLabel(h);
          return (
            <Marker
              key={keyOf(h)}
              position={[h.lat, h.lon]}
              icon={createCustomIcon({
                icon: h.icon || "🏨",
                label: `${h.name?.split(" ")[0] || "Hotel"} · ₹${h.pricePerNight ? Math.round(h.pricePerNight) : ""}`,
                distLabel,
                className: "marker-hotel",
                isSelected,
              })}
              eventHandlers={{ click: () => onSelectHotel?.(h) }}
            >
              <Popup>
                <div className="map-popup-card">
                  <strong>{h.name}</strong>
                  <div className="popup-rating-price">
                    <span>⭐ {h.rating}</span><span>·</span><span>₹{h.pricePerNight}/night</span>
                  </div>
                  {distLabel && <div className="popup-dist-line">{distLabel} from terminal</div>}
                  {h.locationScore && (
                    <div className="popup-score-pill">Location Score: <strong>{h.locationScore}/100</strong></div>
                  )}
                  <p className="popup-address">{h.address}</p>
                  <div className="popup-actions-row">
                    <a
                      className="know-more-btn hotel-know-more-btn"
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${h.name} hotel reviews photos`)}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      🔍 Know more
                    </a>
                    <button type="button" className="primary small popup-btn" onClick={() => onSelectHotel?.(h)}>
                      {isSelected ? "Selected Stay ✓" : "Choose Hotel"}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Transport Hub Markers ────────────────────────────────────── */}
        {showTransport && transportHubs.map((hub) => {
          let icon = "🚌", className = "marker-transport-bus";
          const isSelectedHub = keyOf(hub) === selectedHubKey;
          if (hub.type === "Airport" || hub.type?.toLowerCase().includes("airport")) {
            icon = "✈️"; className = "marker-transport-airport";
          } else if (hub.type === "Railway Station" || hub.type?.toLowerCase().includes("railway") || hub.type?.toLowerCase().includes("train")) {
            icon = "🚉"; className = "marker-transport-railway";
          }
          return (
            <Marker
              key={keyOf(hub)}
              position={[hub.lat, hub.lon]}
              icon={createCustomIcon({ icon, label: hub.name, className, isSelected: isSelectedHub })}
              eventHandlers={{ click: () => onSelectTransportHub?.(hub) }}
            >
              <Popup>
                <div className="map-popup-card">
                  <strong>{hub.name}</strong>
                  <span className="badge hub-badge">{icon} {hub.type}</span>
                  {hub.operator && <p className="popup-operator">Operator: {hub.operator}</p>}
                  <button type="button" className="secondary small popup-btn" onClick={() => onSelectTransportHub?.(hub)}>
                    {isSelectedHub ? "✓ Routes shown — click to clear" : "Show routes to all hotels"}
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
