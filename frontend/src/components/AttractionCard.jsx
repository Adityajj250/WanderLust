import React from "react";

export default function AttractionCard({
  attraction,
  distanceKm,
  isInTrip = false,
  isFocused = false,
  onToggleTrip,
  onFocusMap,
}) {
  const isMustVisit = attraction.priority === "must_visit";
  const isPopular = isMustVisit || (attraction.score || 0) >= 25;
  const hasWikipedia = !!attraction.wikipedia;

  // Calculate synthetic rating (e.g. 4.3 - 4.9) based on popularity score
  const rating = attraction.rating || Math.min(4.9, Math.max(4.2, (4.2 + ((attraction.score || 10) % 8) * 0.1))).toFixed(1);

  // Derive realistic entry price: places of worship & beaches typically free; museums/heritage ₹50-₹200
  const isFree =
    attraction.category === "Place of Worship" ||
    attraction.category === "Beach" ||
    attraction.category === "Park & Nature" ||
    attraction.category === "Nature & Scenic Spot";
  const entryPrice = isFree ? "Free Entry" : `₹${Math.round(50 + ((attraction.score || 15) % 4) * 50)}`;

  return (
    <div className={`card attraction-card ${isInTrip ? "in-trip" : ""} ${isFocused ? "map-focused" : ""} ${isMustVisit ? "attraction-must-visit" : isPopular ? "attraction-popular" : ""}`}>
      {attraction.imageUrl && (
        <div className="card-image-wrap">
          <img src={attraction.imageUrl} alt={attraction.name} className="card-image" loading="lazy" />
          {isMustVisit ? (
            <span className="popular-badge must-visit-badge">⭐ Must-Visit</span>
          ) : isPopular ? (
            <span className="popular-badge">🔥 Hot Pick</span>
          ) : null}
        </div>
      )}
      <div className="card-body">
        <div className="card-title-row">
          <h4>
            <span className="sight-card-icon" style={{ marginRight: "6px" }}>{attraction.icon || "🏛️"}</span>
            {attraction.name}
          </h4>
          <span className="badge category-badge">{attraction.category}</span>
        </div>

        <div className="attraction-meta-row">
          <span className="rating-pill">⭐ {rating}</span>
          <span className={`entry-price-pill ${isFree ? "price-free" : "price-paid"}`}>
            {entryPrice}
          </span>
          {typeof distanceKm === "number" && (
            <span className="distance-pill">🚗 {distanceKm} km</span>
          )}
        </div>

        {attraction.curationReason && (
          <div className="curation-reason-quote">
            <span className="curation-icon">💡</span>
            <span className="curation-text">{attraction.curationReason}</span>
          </div>
        )}

        <p className="card-description">{attraction.description}</p>

        {hasWikipedia && (
          <a
            className="wiki-link"
            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(
              attraction.wikipedia.replace(/^en:/, "")
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            📖 Wikipedia Guide
          </a>
        )}

        <div className="attraction-card-actions">
          {onFocusMap && (
            <button
              type="button"
              className="map-focus-btn secondary small"
              onClick={() => onFocusMap(attraction)}
              title="Show on map"
            >
              📍 Map
            </button>
          )}

          <a
            className="secondary small attraction-more-link know-more-btn"
            href={`https://www.google.com/search?q=${encodeURIComponent(`${attraction.name} ${attraction.category || ""} reviews images`)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Search photos, reviews & details on Google"
          >
            🔍 Know more
          </a>

          <button
            type="button"
            className={`trip-toggle-btn ${isInTrip ? "added" : "primary"}`}
            onClick={() => onToggleTrip && onToggleTrip(attraction)}
          >
            {isInTrip ? "✓ In Trip" : "+ Add to Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}
