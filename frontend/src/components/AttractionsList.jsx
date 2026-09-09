import React, { useState, useMemo } from "react";
import AttractionCard from "./AttractionCard.jsx";
import { useTrip } from "../context/TripContext.jsx";

const CATEGORY_FILTERS = [
  { id: "all", label: "All Sights" },
  { id: "temple", label: "Temples", match: ["Place of Worship", "Temple"] },
  { id: "beach", label: "Beaches", match: ["Beach", "Coast"] },
  { id: "museum", label: "Museums", match: ["Museum", "Art & Culture", "Gallery"] },
  { id: "monument", label: "Monuments", match: ["Monuments & Landmarks", "Monument"] },
  { id: "viewpoint", label: "Viewpoints", match: ["Viewpoint", "Nature & Scenic Spot", "Waterfall"] },
  { id: "heritage", label: "Heritage", match: ["Heritage & Historic Site", "Fort & Palace", "Castle"] },
];

export default function AttractionsList({
  attractions = [],
  hotelDistances = [],
  onFocusMap,
  onStartPlanning,
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const {
    trip,
    addAttraction,
    removeAttraction,
    selectAllAttractions,
    clearAttractions,
    setIsPlanning,
    setCurrentPlanStep,
  } = useTrip();

  const selectedKeys = useMemo(() => {
    return new Set(trip.selectedAttractions.map((a) => a._id || a.osmId || a.name));
  }, [trip.selectedAttractions]);

  const filteredAttractions = useMemo(() => {
    if (activeCategory === "all") return attractions;
    const filter = CATEGORY_FILTERS.find((f) => f.id === activeCategory);
    if (!filter || !filter.match) return attractions;

    return attractions.filter((a) => {
      const cat = a.category || "";
      return filter.match.some((m) => cat.toLowerCase().includes(m.toLowerCase()));
    });
  }, [attractions, activeCategory]);

  function handleToggleTrip(attraction) {
    const key = attraction._id || attraction.osmId || attraction.name;
    if (selectedKeys.has(key)) {
      removeAttraction(key);
    } else {
      addAttraction(attraction);
    }
  }

  function handleSelectTop5() {
    selectAllAttractions(attractions.slice(0, 5));
  }

  function handleSelectAll() {
    selectAllAttractions(attractions);
  }

  function handleClearAll() {
    clearAttractions();
  }

  function handleProceedToPlan() {
    setIsPlanning(true);
    setCurrentPlanStep(1);
    if (onStartPlanning) onStartPlanning();
  }

  return (
    <div className="attractions-tab-view">
      <div className="tab-intro-row">
        <div>
          <h3>Top Attractions & Heritage Sights</h3>
          <p className="tab-subtitle">
            Explore and add places to your trip. Select multiple sights to optimize your hotel and transit around them!
          </p>
        </div>

        {/* Quick batch multi-select controls */}
        <div className="attractions-batch-controls">
          <button
            type="button"
            className="secondary small batch-btn"
            onClick={handleSelectTop5}
            title="Select top 5 iconic sights"
          >
            ⭐ Top 5
          </button>
          <button
            type="button"
            className="secondary small batch-btn"
            onClick={handleSelectAll}
            title="Select all sights"
          >
            ✓ Select All
          </button>
          {trip.selectedAttractions.length > 0 && (
            <button
              type="button"
              className="secondary small batch-btn"
              onClick={handleClearAll}
              title="Clear all selected"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Filters */}
      <div className="category-filter-chips">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`filter-chip ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Selected Sights Floating Bar */}
      {trip.selectedAttractions.length > 0 && (
        <div className="trip-selection-banner">
          <div className="selection-info">
            <span className="selection-count">
              ✓ <strong>{trip.selectedAttractions.length}</strong> {trip.selectedAttractions.length === 1 ? "place" : "places"} selected for your trip
            </span>
          </div>
          <button type="button" className="primary start-plan-btn" onClick={handleProceedToPlan}>
            Plan My Trip with {trip.selectedAttractions.length} {trip.selectedAttractions.length === 1 ? "Sight" : "Sights"} (Step 1) ➔
          </button>
        </div>
      )}

      {/* Cards Grid */}
      {filteredAttractions.length === 0 ? (
        <div className="empty-filter-state">
          <p>No attractions found under "{activeCategory}". Try viewing All Sights.</p>
          <button className="secondary small" onClick={() => setActiveCategory("all")}>
            Show All
          </button>
        </div>
      ) : (
        <div className="attractions-cards-grid">
          {filteredAttractions.map((attraction) => {
            const key = attraction._id || attraction.osmId || attraction.name;
            const dist = hotelDistances.find((d) => d.name === attraction.name || d.id === key);
            const isInTrip = selectedKeys.has(key);

            return (
              <AttractionCard
                key={key}
                attraction={attraction}
                distanceKm={dist?.distanceKm}
                isInTrip={isInTrip}
                onToggleTrip={handleToggleTrip}
                onFocusMap={onFocusMap}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
