import React from "react";

const HUB_ICONS = {
  Airport: "✈️",
  "Railway Station": "🚆",
  "Bus Station": "🚌",
  "Bus Stop": "🚏",
};

export default function TransportHubCard({ hub, isSelected, onSelect }) {
  const icon = HUB_ICONS[hub.type] || "🚏";

  return (
    <div className={`card transport-card ${isSelected ? "selected" : ""}`}>
      <div className="card-body">
        <div className="card-title-row">
          <h4>{hub.name}</h4>
          <span className={`badge hub-badge hub-${hub.type.toLowerCase().replace(/\s+/g, "-")}`}>
            {icon} {hub.type}
          </span>
        </div>
        {hub.operator && <p className="card-description">Operator: {hub.operator}</p>}

        <div className="hotel-actions">
          <button className="secondary" onClick={() => onSelect(hub)}>
            {isSelected ? "Selected ✓" : "View distances to hotels"}
          </button>
        </div>
      </div>
    </div>
  );
}
