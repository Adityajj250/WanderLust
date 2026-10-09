import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTrip } from "../context/TripContext.jsx";
import { computeHotelLocationScores } from "../utils/locationScore.js";

export default function HotelsList({
  hotels = [],
  attractions = [],
  arrivalHub = null,
  selectedHotel = null,
  onSelectHotel,
  onFocusMap,
  onContinueToTrip,
}) {
  const [priceSort, setPriceSort] = useState("low");
  const [priceMax, setPriceMax] = useState("all");
  const [expandedHotelKey, setExpandedHotelKey] = useState(null);
  const { trip, selectHotel } = useTrip();
  const listRef = useRef(null);

  // Scroll to the selected hotel card whenever selectedHotel changes
  useEffect(() => {
    if (!selectedHotel) return;
    const key = selectedHotel._id || selectedHotel.osmId || selectedHotel.name;
    // Brief timeout lets React finish rendering the card (it may have just appeared)
    const t = setTimeout(() => {
      const el = document.getElementById(`hotel-card-${key}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedHotel]);

  // Target attractions: use trip selected attractions if user added any, else default to top 4 iconic attractions
  const targetAttractions = useMemo(() => {
    return trip.selectedAttractions.length > 0 ? trip.selectedAttractions : attractions.slice(0, 4);
  }, [trip.selectedAttractions, attractions]);

  // Compute location scores
  const scoredHotels = useMemo(() => {
    return computeHotelLocationScores(hotels, targetAttractions, arrivalHub || trip.arrivalHub);
  }, [hotels, targetAttractions, arrivalHub, trip.arrivalHub]);

  // Price-wise filter and sorting
  const filteredHotels = useMemo(() => {
    let list = scoredHotels.filter((h) => {
      const p = h.pricePerNight || 0;
      if (priceMax === "2500") return p <= 2500;
      if (priceMax === "4000") return p <= 4000;
      if (priceMax === "6000") return p <= 6000;
      return true;
    });

    return list.sort((a, b) => {
      if (priceSort === "low") return (a.pricePerNight || 0) - (b.pricePerNight || 0);
      if (priceSort === "high") return (b.pricePerNight || 0) - (a.pricePerNight || 0);
      if (priceSort === "rating") return (b.rating || 0) - (a.rating || 0);
      return (b.locationScore || 0) - (a.locationScore || 0);
    });
  }, [scoredHotels, priceMax, priceSort]);

  const [showAllHotels, setShowAllHotels] = useState(false);

  const activeTripHotelKey =
    trip.selectedHotel?._id || trip.selectedHotel?.osmId || trip.selectedHotel?.name;

  function handleChooseHotel(hotel) {
    const hotelKey = hotel._id || hotel.osmId || hotel.name;
    // If user clicks the already selected hotel, unselect it and restore all hotels
    if (activeTripHotelKey === hotelKey) {
      selectHotel(null);
      setShowAllHotels(true);
      if (onSelectHotel) onSelectHotel(null);
      return;
    }
    selectHotel(hotel);
    setShowAllHotels(false);
    if (onSelectHotel) onSelectHotel(hotel);
  }

  function toggleDistanceBreakdown(hotelKey) {
    setExpandedHotelKey((prev) => (prev === hotelKey ? null : hotelKey));
  }

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
            <span className="hotel-banner-icon">{trip.selectedHotel.icon || "🏨"}</span>
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
        <div className="hotel-filters-toolbar">
          <div className="hotel-filter-pills">
            <span className="filter-label">Max Price:</span>
            {[
              { id: "all", label: "All Prices" },
              { id: "2500", label: "Under ₹2,500" },
              { id: "4000", label: "Under ₹4,000" },
              { id: "6000", label: "Under ₹6,000" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-chip ${priceMax === f.id ? "active" : ""}`}
                onClick={() => setPriceMax(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="hotel-sort-wrap">
            <span className="filter-label">Sort:</span>
            <select
              className="hotel-sort-select"
              value={priceSort}
              onChange={(e) => setPriceSort(e.target.value)}
            >
              <option value="low">💰 Price: Low to High</option>
              <option value="high">💎 Price: High to Low</option>
              <option value="rating">⭐ Top Rated</option>
              <option value="score">📍 Best Location</option>
            </select>
          </div>

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
              id={`hotel-card-${hotelKey}`}
              className={`hotel-score-card ${isSelected ? "selected" : ""} ${
                h.badge ? `badge-${h.badge.type}` : ""
              }`}
            >
              <div className="hotel-top-row">
                <div className="hotel-main-details">
                  <div className="hotel-header-line">
                    <h4>
                      <span className="hotel-card-icon" style={{ marginRight: "6px" }}>{h.icon || "🏨"}</span>
                      {h.name}
                    </h4>
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
                <a
                  className="know-more-btn hotel-know-more-btn"
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${h.name} ${trip.destination?.displayName?.split(",")[0] || trip.destination?.query || ""} hotel reviews photos`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Search reviews and photos on Google"
                >
                  🔍 Know more
                </a>

                {onFocusMap && (
                  <button
                    type="button"
                    className="map-focus-btn secondary small"
                    onClick={() => onFocusMap(h)}
                    title="Highlight on map and show routes to attractions"
                  >
                    📍 Map
                  </button>
                )}

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
