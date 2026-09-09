import React, { useState, useMemo } from "react";
import { useTrip } from "../context/TripContext.jsx";
import { computeHotelLocationScores } from "../utils/locationScore.js";

const PRICE_FILTERS = [
  { id: "all", label: "All Rates" },
  { id: "budget", label: "Budget (< ₹2.5k)", max: 2500 },
  { id: "moderate", label: "Moderate (₹2.5k–₹4.5k)", min: 2500, max: 4500 },
  { id: "luxury", label: "Luxury (> ₹4.5k)", min: 4500 },
];

export default function HotelsList({
  hotels = [],
  attractions = [],
  arrivalHub = null,
  selectedHotel = null,
  onSelectHotel,
  onContinueToTrip,
}) {
  const [priceFilter, setPriceFilter] = useState("all");
  const [expandedHotelKey, setExpandedHotelKey] = useState(null);
  const { trip, selectHotel } = useTrip();

  // Target attractions: use trip selected attractions if user added any, else default to top 4 iconic attractions
  const targetAttractions = useMemo(() => {
    return trip.selectedAttractions.length > 0 ? trip.selectedAttractions : attractions.slice(0, 4);
  }, [trip.selectedAttractions, attractions]);

  // Compute location scores
  const scoredHotels = useMemo(() => {
    return computeHotelLocationScores(hotels, targetAttractions, arrivalHub || trip.arrivalHub);
  }, [hotels, targetAttractions, arrivalHub, trip.arrivalHub]);

  // Apply price filter
  const filteredHotels = useMemo(() => {
    return scoredHotels.filter((h) => {
      const p = h.pricePerNight || 0;
      if (priceFilter === "budget") return p < 2500;
      if (priceFilter === "moderate") return p >= 2500 && p <= 4500;
      if (priceFilter === "luxury") return p > 4500;
      return true;
    });
  }, [scoredHotels, priceFilter]);

  const [showAllHotels, setShowAllHotels] = useState(false);

  function handleChooseHotel(hotel) {
    selectHotel(hotel);
    setShowAllHotels(false);
    if (onSelectHotel) onSelectHotel(hotel);
  }

  function toggleDistanceBreakdown(hotelKey) {
    setExpandedHotelKey((prev) => (prev === hotelKey ? null : hotelKey));
  }

  const activeTripHotelKey =
    trip.selectedHotel?._id || trip.selectedHotel?.osmId || trip.selectedHotel?.name;

  const displayedHotels = useMemo(() => {
    if (trip.selectedHotel && !showAllHotels) {
      const selected =
        scoredHotels.find((h) => (h._id || h.osmId || h.name) === activeTripHotelKey) ||
        trip.selectedHotel;
      return [selected];
    }
    return filteredHotels;
  }, [trip.selectedHotel, showAllHotels, scoredHotels, activeTripHotelKey, filteredHotels]);

  return (
    <div className="hotels-tab-view">
      <div className="tab-intro-row">
        <div>
          <h3>Where Should You Stay?</h3>
          <p className="tab-subtitle">
            Ranked by our <strong>Location Optimization Engine</strong> to balance{" "}
            <strong>Price ↔ Location ↔ Quality</strong> based on your {targetAttractions.length}{" "}
            selected places.
          </p>
        </div>
      </div>

      {trip.selectedHotel && !showAllHotels ? (
        <div className="selected-hotel-banner" style={{ marginBottom: "16px" }}>
          <div className="selected-hotel-banner-title">
            <span className="hotel-banner-icon">🏨</span>
            <div>
              <strong>Your Selected Hotel</strong>
              <span className="hotel-banner-sub">Other hotels are hidden</span>
            </div>
          </div>
          <button
            type="button"
            className="change-hotel-btn"
            onClick={() => setShowAllHotels(true)}
          >
            🔄 Show Other Hotels
          </button>
        </div>
      ) : (
        /* Budget Filter Chips */
        <div className="category-filter-chips">
          {PRICE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${priceFilter === f.id ? "active" : ""}`}
              onClick={() => setPriceFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          {trip.selectedHotel && showAllHotels && (
            <button
              type="button"
              className="cancel-change-hotel-btn"
              onClick={() => setShowAllHotels(false)}
            >
              Keep Selected Only
            </button>
          )}
        </div>
      )}

      {/* Scored Hotels List */}
      <div className="hotels-scored-list">
        {displayedHotels.map((h) => {
          const hotelKey = h._id || h.osmId || h.name;
          const isSelected =
            hotelKey === activeTripHotelKey ||
            (selectedHotel && (selectedHotel._id || selectedHotel.osmId || selectedHotel.name) === hotelKey);
          const isExpanded = expandedHotelKey === hotelKey;

          return (
            <div
              key={hotelKey}
              className={`hotel-score-card ${isSelected ? "selected" : ""} ${
                h.badge ? `badge-${h.badge.type}` : ""
              }`}
            >
              <div className="hotel-top-row">
                <div className="hotel-main-details">
                  <div className="hotel-header-line">
                    <h4>{h.name}</h4>
                    {h.badge && <span className={`rank-badge ${h.badge.type}`}>{h.badge.label}</span>}
                  </div>

                  <div className="hotel-pricing-rating">
                    <span className="hotel-rate">₹{h.pricePerNight?.toLocaleString("en-IN")} / night</span>
                    <span className="hotel-rating">⭐ {h.rating}</span>
                  </div>

                  <p className="hotel-address">{h.address}</p>
                </div>

                {/* Prominent Location Score Gauge */}
                <div className="location-score-badge-wrap">
                  <div className="score-number-pill">
                    <span className="score-num">{h.locationScore}</span>
                    <span className="score-max">/100</span>
                  </div>
                  <span className="score-caption">Location Score</span>
                </div>
              </div>

              {/* Proximity Metrics Bar */}
              <div className="hotel-proximity-metrics">
                <div className="metric-pill">
                  <span className="metric-icon">📍</span>
                  <span>Avg to sights: <strong>{h.avgDistToAttractions} km</strong></span>
                </div>

                <div className="metric-pill">
                  <span className="metric-icon">🚆</span>
                  <span>
                    Arrival terminal:{" "}
                    <strong>
                      {h.distToArrival ? `${h.distToArrival} km` : "Nearby"}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Amenities */}
              {h.amenities?.length > 0 && (
                <div className="hotel-amenities-row">
                  {h.amenities.slice(0, 4).map((a) => (
                    <span key={a} className="amenity-tag">
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {/* Expandable Distances Breakdown */}
              {isExpanded && h.attractionDistances?.length > 0 && (
                <div className="hotel-distances-breakdown">
                  <h5>Distances to your selected sights:</h5>
                  <div className="breakdown-grid">
                    {h.attractionDistances.map((sight) => (
                      <div key={sight.name} className="breakdown-item">
                        <span className="sight-name">{sight.name}</span>
                        <span className="sight-dist">{sight.distanceKm} km</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card Actions */}
              <div className="hotel-card-actions">
                <button
                  type="button"
                  className="secondary small breakdown-btn"
                  onClick={() => toggleDistanceBreakdown(hotelKey)}
                >
                  {isExpanded ? "Hide Distances ▲" : "View Distances ▼"}
                </button>

                <button
                  type="button"
                  className={`select-hotel-btn ${isSelected ? "selected" : "primary"}`}
                  onClick={() => handleChooseHotel(h)}
                >
                  {isSelected ? "Selected for Stay ✓" : "Choose Hotel"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
