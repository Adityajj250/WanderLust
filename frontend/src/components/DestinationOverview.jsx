import React, { useMemo } from "react";

export default function DestinationOverview({
  destination,
  attractions = [],
  onExploreAttractions,
  onStartPlanning,
}) {

  // Extract concise city and region/country
  const { cityName, regionCountry } = useMemo(() => {
    if (!destination?.displayName) return { cityName: "Destination", regionCountry: "" };
    const parts = destination.displayName.split(",").map((s) => s.trim());
    const city = parts[0] || destination.query || "Destination";
    const country = parts[parts.length - 1] || "";
    const stateOrRegion = parts.length > 2 ? parts[parts.length - 2] : "";
    const region = [stateOrRegion, country].filter(Boolean).join(", ");
    return { cityName: city, regionCountry: region };
  }, [destination]);

  // Derive "BEST FOR" tags dynamically from attraction categories
  const bestForTags = useMemo(() => {
    const tags = new Set();
    attractions.forEach((a) => {
      const cat = a.category || "";
      if (cat.includes("Worship") || cat.includes("Temple")) tags.add("🏛️ Temples & Sacred Sites");
      else if (cat.includes("Beach") || cat.includes("Coast")) tags.add("🏖️ Beaches & Coastline");
      else if (cat.includes("Fort") || cat.includes("Palace") || cat.includes("Heritage")) tags.add("🏰 Heritage & Forts");
      else if (cat.includes("Nature") || cat.includes("Park") || cat.includes("Waterfall")) tags.add("🌲 Nature & Waterfalls");
      else if (cat.includes("Museum") || cat.includes("Art")) tags.add("🎨 Museums & Culture");
      else if (cat.includes("Viewpoint")) tags.add("📸 Scenic Viewpoints");
    });

    // Always include photography and authentic food for rich experience
    tags.add("🍛 Authentic Cuisine");
    tags.add("📸 Photography");

    return Array.from(tags).slice(0, 5);
  }, [attractions]);

  // Top iconic places (top 4 ranked)
  const topPlaces = useMemo(() => {
    return attractions.slice(0, 4);
  }, [attractions]);

  return (
    <div className="destination-overview-card">
      <div className="overview-header-badge">🌍 Destination Guide</div>

      <div className="overview-title-block">
        <h2 className="overview-destination-name">{cityName}</h2>
        {regionCountry && <p className="overview-region">{regionCountry}</p>}
      </div>

      <p className="overview-lead-description">
        A captivating destination renowned for its rich culture, iconic sights, and unique atmosphere.
        Whether you are seeking historic landmarks, scenic landscapes, or authentic culinary experiences,{" "}
        <strong>{cityName}</strong> offers an unforgettable journey.
      </p>

      <div className="overview-section">
        <h4 className="overview-section-label">BEST SUITED FOR</h4>
        <div className="overview-tags-grid">
          {bestForTags.map((tag) => (
            <span key={tag} className="overview-best-for-pill">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="overview-section duration-section">
        <h4 className="overview-section-label">RECOMMENDED STAY</h4>
        <div className="duration-pill">
          <span className="duration-icon">⏱️</span>
          <strong>2–3 Days</strong> for a balanced and relaxed experience
        </div>
      </div>

      {topPlaces.length > 0 && (
        <div className="overview-section">
          <h4 className="overview-section-label">TOP ICONIC PLACES</h4>
          <div className="overview-top-places-list">
            {topPlaces.map((place) => (
              <div key={place._id || place.osmId || place.name} className="top-place-item">
                <span className="bullet">✦</span>
                <div className="top-place-details">
                  <span className="place-name">{place.name}</span>
                  <span className="place-cat">{place.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overview-actions-row overview-actions-right">
        <button
          type="button"
          className="primary overview-explore-btn"
          onClick={onExploreAttractions}
        >
          Explore Attractions ➔
        </button>
      </div>
    </div>
  );
}
