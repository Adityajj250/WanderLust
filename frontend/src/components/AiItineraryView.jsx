import React, { useState, useMemo } from "react";
import { parseItinerary } from "../utils/itineraryParser.js";

export default function AiItineraryView({
  result,
  onBuildTripOnMap,
  onBack,
  onClose,
}) {
  const [activeDayTab, setActiveDayTab] = useState("all");
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    return parseItinerary(result?.itinerary || "");
  }, [result?.itinerary]);

  const recommendedPlaces = result?.recommendedPlaces || [];
  const destinationName = result?.destination || "Destination";
  const durationDays = result?.days || parsed.days?.length || 3;

  function handleCopy() {
    if (!result?.itinerary) return;
    navigator.clipboard.writeText(result.itinerary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Determine which days to display based on active tab
  const displayedDays = useMemo(() => {
    if (activeDayTab === "all") return parsed.days;
    return parsed.days.filter((d) => d.dayNum === Number(activeDayTab));
  }, [parsed.days, activeDayTab]);

  return (
    <div className="ai-itinerary-representation">
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="itinerary-header-card">
        <div className="itinerary-header-left">
          <div className="itinerary-badge-row">
            <span className="itinerary-sparkle-pill">✨ Curated Itinerary</span>
            <span className="itinerary-spec-pill">⏱️ {durationDays} Days</span>
            <span className="itinerary-spec-pill">📍 {destinationName}</span>
          </div>
          <h2 className="itinerary-main-title">
            {parsed.title || `${durationDays}-Day Trip to ${destinationName}`}
          </h2>
        </div>

        <div className="itinerary-header-actions">
          <button
            type="button"
            className="secondary small itinerary-action-btn"
            onClick={handleCopy}
            title="Copy raw markdown to clipboard"
          >
            {copied ? "✓ Copied!" : "📋 Copy"}
          </button>
          {onBack && (
            <button
              type="button"
              className="secondary small itinerary-action-btn"
              onClick={onBack}
              title="Change destination or interests"
            >
              ✏️ Edit
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Trip Highlights Callout ────────────────────────────────── */}
      {parsed.summary && (
        <div className="itinerary-summary-card">
          <span className="summary-quote-icon">🌟</span>
          <div className="summary-quote-body">
            <h4>Trip Highlights</h4>
            <p>{parsed.summary}</p>
          </div>
        </div>
      )}

      {/* ── Recommended Places Checklist Strip ─────────────────────── */}
      {recommendedPlaces.length > 0 && (
        <div className="itinerary-recommended-strip">
          <div className="rec-strip-header">
            <span className="rec-strip-title">
              📌 <strong>{recommendedPlaces.length}</strong> Recommended Places for Your Map
            </span>
            <span className="rec-strip-sub">
              (Will be plotted on OpenStreetMap with multi-select enabled)
            </span>
          </div>
          <div className="rec-places-chips">
            {recommendedPlaces.map((place, idx) => (
              <span key={idx} className="rec-place-pill">
                📍 {place}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Day-by-Day Interactive Schedule ────────────────────────── */}
      <div className="itinerary-schedule-section">
        <div className="schedule-section-header">
          <h3>🗓️ Day-by-Day Schedule</h3>

          {parsed.days.length > 1 && (
            <div className="day-tabs-pill-group">
              <button
                type="button"
                className={`day-tab-pill ${activeDayTab === "all" ? "active" : ""}`}
                onClick={() => setActiveDayTab("all")}
              >
                All Days
              </button>
              {parsed.days.map((d) => (
                <button
                  key={d.dayNum}
                  type="button"
                  className={`day-tab-pill ${activeDayTab === String(d.dayNum) ? "active" : ""}`}
                  onClick={() => setActiveDayTab(String(d.dayNum))}
                >
                  Day {d.dayNum}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Days List */}
        {displayedDays.length > 0 ? (
          <div className="days-cards-stack">
            {displayedDays.map((day) => (
              <div key={day.dayNum} className="day-card-container">
                <div className="day-card-header">
                  <span className="day-number-badge">Day {day.dayNum}</span>
                  <h4 className="day-title-text">{day.title}</h4>
                </div>

                <div className="day-time-slots-grid">
                  {/* Morning Slot */}
                  {day.morning ? (
                    <div className="time-slot-card morning">
                      <div className="time-slot-title">
                        <span className="slot-icon">🌅</span>
                        <strong>Morning</strong>
                        <span className="slot-time">9:00 AM – 1:00 PM</span>
                      </div>
                      <p className="slot-content">{day.morning}</p>
                    </div>
                  ) : null}

                  {/* Afternoon Slot */}
                  {day.afternoon ? (
                    <div className="time-slot-card afternoon">
                      <div className="time-slot-title">
                        <span className="slot-icon">☀️</span>
                        <strong>Afternoon</strong>
                        <span className="slot-time">1:00 PM – 5:00 PM</span>
                      </div>
                      <p className="slot-content">{day.afternoon}</p>
                    </div>
                  ) : null}

                  {/* Evening Slot */}
                  {day.evening ? (
                    <div className="time-slot-card evening">
                      <div className="time-slot-title">
                        <span className="slot-icon">🌙</span>
                        <strong>Evening</strong>
                        <span className="slot-time">5:00 PM onwards</span>
                      </div>
                      <p className="slot-content">{day.evening}</p>
                    </div>
                  ) : null}

                  {/* Fallback if slots not cleanly extracted */}
                  {!day.morning && !day.afternoon && !day.evening && day.rawBody && (
                    <div className="time-slot-card generic">
                      <p className="slot-content">{day.rawBody}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback raw renderer if day parser found 0 days */
          <div className="itinerary-fallback-body">
            <div className="markdown-prose">
              {result.itinerary.split("\n\n").map((para, i) => {
                if (para.startsWith("#")) {
                  return (
                    <h4 key={i} className="prose-heading">
                      {para.replace(/^#+\s*/, "")}
                    </h4>
                  );
                }
                return (
                  <p key={i} className="prose-paragraph">
                    {para}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Travel Guide Insights (4-Card Grid) ────────────────────── */}
      <div className="itinerary-insights-grid">
        {parsed.whereToStay && (
          <div className="insight-card stay">
            <div className="insight-card-header">
              <span className="insight-icon">🏨</span>
              <h5>Where to Stay</h5>
            </div>
            <p>{parsed.whereToStay}</p>
          </div>
        )}

        {parsed.transport && (
          <div className="insight-card transport">
            <div className="insight-card-header">
              <span className="insight-icon">🚕</span>
              <h5>Getting Around</h5>
            </div>
            <p>{parsed.transport}</p>
          </div>
        )}

        {parsed.cuisine && (
          <div className="insight-card cuisine">
            <div className="insight-card-header">
              <span className="insight-icon">🍽️</span>
              <h5>Must-Try Cuisine</h5>
            </div>
            <p>{parsed.cuisine}</p>
          </div>
        )}

        {parsed.tips && (
          <div className="insight-card tips">
            <div className="insight-card-header">
              <span className="insight-icon">💡</span>
              <h5>Practical Tips</h5>
            </div>
            <p>{parsed.tips}</p>
          </div>
        )}
      </div>

      {/* ── Primary Action Bar ─────────────────────────────────────── */}
      <div className="itinerary-cta-banner">
        <div className="cta-banner-text">
          <strong>Ready to explore on the map?</strong>
          <span>
            Transfer these {recommendedPlaces.length || "curated"} sights to OpenStreetMap, pick your favorite places, and calculate hotel routes.
          </span>
        </div>
        <button
          type="button"
          className="primary build-map-hero-btn"
          onClick={onBuildTripOnMap}
        >
          🗺️ Implement Plan on Map ➔
        </button>
      </div>
    </div>
  );
}
