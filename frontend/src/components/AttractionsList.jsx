import React, { useState, useMemo, useEffect } from "react";
import AttractionCard from "./AttractionCard.jsx";
import { useTrip } from "../context/TripContext.jsx";

const CATEGORY_FILTERS = [
  { id: "all", label: "All Sights" },
  { id: "temple", label: "🛕 Temples & Worship", match: ["Place of Worship", "Temple", "Mosque", "Church"] },
  { id: "beach", label: "🏖️ Beaches & Waters", match: ["Beach", "Coast", "Swimming Area", "Waterfall"] },
  { id: "museum", label: "🏛️ Museums & Culture", match: ["Museum", "Art & Culture", "Gallery", "Theatre"] },
  { id: "monument", label: "🗿 Monuments & Landmarks", match: ["Monuments & Landmarks", "Monument", "Theme Park", "Stadium", "Attraction"] },
  { id: "heritage", label: "🏰 Heritage & Forts", match: ["Heritage & Historic Site", "Fort & Palace", "Castle", "Ruins", "Archaeological Site"] },
  { id: "nature", label: "🌅 Nature & Views", match: ["Nature", "Park", "Viewpoint", "Reserve", "Zoo"] },
  { id: "dining", label: "🍽️ Dining & Markets", match: ["Restaurant", "Cafe", "Food", "Market", "Mall", "Shopping"] },
];

export default function AttractionsList({
  attractions = [],
  hotelDistances = [],
  onFocusMap,
  onStartPlanning,
  focusedAttraction = null,
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const {
    trip,
    addAttraction,
    removeAttraction,
    clearAttractions,
    setIsPlanning,
    setCurrentPlanStep,
  } = useTrip();

  // When a sight is focused from the map: ensure it's visible (reset category
  // filter if needed) then scroll to it. A short timeout lets React flush the
  // potential category reset before we query the DOM.
  useEffect(() => {
    if (!focusedAttraction) return;
    const key = focusedAttraction._id || focusedAttraction.osmId || focusedAttraction.name;

    // If the current filter is hiding this attraction, reset to "all"
    if (activeCategory !== "all") {
      const filter = CATEGORY_FILTERS.find((f) => f.id === activeCategory);
      const cat = focusedAttraction.category || "";
      const visible = !filter?.match || filter.match.some((m) => cat.toLowerCase().includes(m.toLowerCase()));
      if (!visible) setActiveCategory("all");
    }

    const t = setTimeout(() => {
      const el = document.getElementById(`attraction-card-${key}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => clearTimeout(t);
  }, [focusedAttraction]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <h3>Curated Hot Picks & Heritage Sights</h3>
          <p className="tab-subtitle">
            Real OpenStreetMap landmarks curated by Gemini AI for your trip. Select sights to optimize your hotel and transit around them!
          </p>
        </div>

        <div className="attractions-batch-controls">
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
              <div key={key} id={`attraction-card-${key}`}>
                <AttractionCard
                  attraction={attraction}
                  distanceKm={dist?.distanceKm}
                  isInTrip={isInTrip}
                  onToggleTrip={handleToggleTrip}
                  onFocusMap={onFocusMap}
                  isFocused={(focusedAttraction?._id || focusedAttraction?.osmId || focusedAttraction?.name) === key}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
