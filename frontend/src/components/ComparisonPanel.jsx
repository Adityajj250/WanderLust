import React from "react";

/**
 * Shows a side-by-side comparison of hotels the user has "pinned" for comparison.
 * Each entry carries its own distances (computed once per hotel selection),
 * so no extra fetch is needed here.
 */
export default function ComparisonPanel({ comparisons, onRemove }) {
  if (!comparisons.length) {
    return (
      <p className="empty-hint">
        Select "Compare" on a couple of hotels to see them side by side here.
      </p>
    );
  }

  return (
    <div className="comparison-grid">
      {comparisons.map((c) => (
        <div key={c.hotel._id || c.hotel.name} className="comparison-card">
          <div className="comparison-header">
            <h4>{c.hotel.name}</h4>
            <button className="remove-btn" onClick={() => onRemove(c.hotel)}>✕</button>
          </div>
          <p className="price">₹{c.hotel.pricePerNight?.toLocaleString("en-IN")} / night</p>
          <p className="rating">⭐ {c.hotel.rating}</p>
          <ul className="comparison-distances">
            {c.distances.slice(0, 5).map((d) => (
              <li key={d.id}>
                <span>{d.name}</span>
                <span>{d.distanceKm} km</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
