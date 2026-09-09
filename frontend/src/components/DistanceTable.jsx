import React from "react";

export default function DistanceTable({
  originName,
  hotelName,
  destinationLabel = "Destination",
  distances = [],
  onClear,
}) {
  const name = originName || hotelName;
  if (!distances?.length) return null;

  return (
    <div className="distance-table-wrap">
      <div className="distance-table-header">
        <h4>Distances from {name}</h4>
        {onClear && (
          <button className="clear-selection-btn" onClick={onClear} title="Clear selection & paths">
            ✕ Clear
          </button>
        )}
      </div>
      <div className="distance-table-scroll">
        <table className="distance-table">
          <thead>
            <tr>
              <th>{destinationLabel}</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>
            {distances.map((d) => (
              <tr key={d.id || d.name}>
                <td>{d.name}</td>
                <td>
                  <span className="dist-chip">{d.distanceKm} km</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fine-print">
        Showing straight-line paths & distances directly on map.
      </p>
    </div>
  );
}
