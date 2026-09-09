import React, { useState, useMemo } from "react";
import { useTrip } from "../context/TripContext.jsx";

const ARRIVAL_MODES = [
  { id: "train", label: "Train", icon: "🚆", hubType: "Railway Station", desc: "Railway Station / Express" },
  { id: "airport", label: "Airport", icon: "✈️", hubType: "Airport", desc: "Flight / Regional Airport" },
  { id: "bus", label: "Bus", icon: "🚌", hubType: "Bus Station", desc: "Intercity Bus Terminal" },
  { id: "car", label: "Self Drive", icon: "🚗", hubType: "Other", desc: "Car / City Center Entry" },
];

export default function TransportView({
  destination,
  transportHubs = [],
  hotels = [],
  onSelectHub,
  onStartPlanning,
}) {
  const { trip, selectArrivalHub } = useTrip();
  const [selectedMode, setSelectedMode] = useState("train");

  // Determine current active hub
  const activeHub = useMemo(() => {
    if (trip.arrivalHub) return trip.arrivalHub;
    const mode = ARRIVAL_MODES.find((m) => m.id === selectedMode);
    if (!mode) return null;

    if (mode.hubType === "Other") {
      return {
        name: `${destination.displayName.split(",")[0]} City Center Entry`,
        type: "Other",
        lat: destination.lat,
        lon: destination.lon,
      };
    }

    const matched = transportHubs.find((h) => h.type === mode.hubType);
    if (matched) return matched;

    // Fallback: bus stop if bus station not found
    if (mode.id === "bus") {
      const stop = transportHubs.find((h) => h.type === "Bus Stop");
      if (stop) return stop;
    }

    // Default fallback
    return {
      name: `${destination.displayName.split(",")[0]} ${mode.label} Terminal`,
      type: mode.hubType,
      lat: destination.lat + 0.012,
      lon: destination.lon + 0.012,
    };
  }, [trip.arrivalHub, selectedMode, transportHubs, destination]);

  function handleModeChange(mode) {
    setSelectedMode(mode.id);
    let hub = null;

    if (mode.hubType === "Other") {
      hub = {
        name: `${destination.displayName.split(",")[0]} City Center Entry`,
        type: "Other",
        lat: destination.lat,
        lon: destination.lon,
      };
    } else {
      hub = transportHubs.find((h) => h.type === mode.hubType);
      if (!hub && mode.id === "bus") {
        hub = transportHubs.find((h) => h.type === "Bus Stop");
      }
      if (!hub) {
        hub = {
          name: `${destination.displayName.split(",")[0]} ${mode.label} Terminal`,
          type: mode.hubType,
          lat: destination.lat + 0.012,
          lon: destination.lon + 0.012,
        };
      }
    }

    selectArrivalHub(hub);
    if (onSelectHub) onSelectHub(hub);
  }

  return (
    <div className="transport-tab-view">
      <div className="tab-intro-row">
        <div>
          <h3>How Will You Arrive?</h3>
          <p className="tab-subtitle">
            Choose your entry point into {destination.displayName.split(",")[0]}. We'll plot transit
            connections and calculate road routes to hotels.
          </p>
        </div>
      </div>

      {/* Arrival Mode Selection Grid */}
      <div className="arrival-modes-grid">
        {ARRIVAL_MODES.map((mode) => {
          const isSelected =
            selectedMode === mode.id ||
            (trip.arrivalHub && trip.arrivalHub.type === mode.hubType);

          return (
            <button
              key={mode.id}
              type="button"
              className={`arrival-mode-tile ${isSelected ? "selected" : ""}`}
              onClick={() => handleModeChange(mode)}
            >
              <span className="mode-icon">{mode.icon}</span>
              <span className="mode-name">{mode.label}</span>
              <span className="mode-desc">{mode.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Active Arrival Terminal Card */}
      {activeHub && (
        <div className="active-terminal-card">
          <div className="terminal-header">
            <span className="terminal-icon">📍</span>
            <div>
              <span className="terminal-badge">Confirmed Arrival Terminal</span>
              <h4>{activeHub.name}</h4>
              <p className="terminal-type">{activeHub.type}</p>
            </div>
          </div>

          <div className="terminal-proximity-box">
            <h5>Nearby Accommodations & Transit Proximity:</h5>
            <div className="nearby-hotels-list">
              {hotels.slice(0, 4).map((h) => {
                return (
                  <div key={h._id || h.osmId || h.name} className="terminal-hotel-row">
                    <div>
                      <strong>{h.name}</strong>
                      <span className="rate-hint">₹{h.pricePerNight?.toLocaleString("en-IN")} / night</span>
                    </div>
                    <span className="travel-time-chip">🚗 ~10-15 mins drive</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="terminal-action-row">
            <button
              type="button"
              className="primary proceed-plan-btn"
              onClick={onStartPlanning}
            >
              Continue with this Arrival Terminal ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
