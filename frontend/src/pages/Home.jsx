import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../context/TripContext.jsx";
import SunshineHomeModal from "../components/SunshineHomeModal.jsx";

const POPULAR_DESTINATIONS = ["Udupi", "Goa", "Mysuru", "Manali"];

export default function Home() {
  const { trip, setTripDates, setTravellers } = useTrip();
  const [query, setQuery] = useState(trip.destination?.query || "");
  const [startDate, setStartDate] = useState(trip.startDate || "");
  const [endDate, setEndDate] = useState(trip.endDate || "");
  const [travellerCount, setTravellerCount] = useState(trip.travellers || 1);
  const [error, setError] = useState("");
  const [isSunshineOpen, setIsSunshineOpen] = useState(false);

  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split("T")[0];

  function handleTravellerChange(delta) {
    setTravellerCount((prev) => Math.max(1, Math.min(50, Number(prev || 1) + delta)));
  }

  function handleDirectTravellerInput(e) {
    const val = parseInt(e.target.value, 10);
    if (Number.isNaN(val)) {
      setTravellerCount(1);
    } else {
      setTravellerCount(Math.max(1, Math.min(50, val)));
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Please enter a destination name.");
      return;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError("Returning date cannot be before going date.");
      return;
    }

    setError("");
    setTripDates({ startDate, endDate });
    setTravellers(travellerCount);
    navigate(`/destination/${encodeURIComponent(trimmed)}`);
  }

  function handleChipClick(dest) {
    setQuery(dest);
  }

  return (
    <section className="home-hero-section">
      <div className="home-hero-container">
        <h1 className="home-hero-title">Plan Your Journey with WanderLust</h1>
        <p className="home-hero-subtitle">
          Search your destination, set your travel dates & travellers, and explore curated sights, hotels, and live transit.
        </p>

        <form className="home-search-widget" onSubmit={handleSubmit}>
          {/* Destination Field */}
          <div className="search-widget-field field-destination">
            <label htmlFor="home-dest-input" className="widget-label">
              📍 Destination
            </label>
            <div className="search-input-wrap">
              <input
                id="home-dest-input"
                type="text"
                placeholder="Where to? (e.g. Paris, Goa, Udupi)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Destination search"
                autoFocus
              />
            </div>
          </div>

          {/* Dates Field: Going & Returning with Calendar Picker */}
          <div className="search-widget-row-dates">
            <div className="search-widget-field field-date">
              <label htmlFor="home-start-date" className="widget-label">
                🗓️ Going Date
              </label>
              <div
                className="date-input-wrap"
                onClick={(e) => {
                  const input = e.currentTarget.querySelector("input");
                  input?.showPicker?.();
                }}
              >
                <input
                  id="home-start-date"
                  type="date"
                  min={todayStr}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && new Date(e.target.value) > new Date(endDate)) {
                      setEndDate(e.target.value);
                    }
                  }}
                  className="calendar-date-input"
                  title="Click to select departure date"
                />
              </div>
            </div>

            <div className="search-widget-field field-date">
              <label htmlFor="home-end-date" className="widget-label">
                🏁 Returning Date
              </label>
              <div
                className="date-input-wrap"
                onClick={(e) => {
                  const input = e.currentTarget.querySelector("input");
                  input?.showPicker?.();
                }}
              >
                <input
                  id="home-end-date"
                  type="date"
                  min={startDate || todayStr}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="calendar-date-input"
                  title="Click to select return date"
                />
              </div>
            </div>
          </div>

          {/* Number of Travellers Field with +/- buttons */}
          <div className="search-widget-field field-travellers">
            <label className="widget-label">👥 Travellers</label>
            <div className="traveller-stepper">
              <button
                type="button"
                className="stepper-btn stepper-minus"
                onClick={() => handleTravellerChange(-1)}
                disabled={travellerCount <= 1}
                aria-label="Decrease travellers"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max="50"
                value={travellerCount}
                onChange={handleDirectTravellerInput}
                className="traveller-number-input"
                aria-label="Traveller count"
              />
              <button
                type="button"
                className="stepper-btn stepper-plus"
                onClick={() => handleTravellerChange(1)}
                aria-label="Increase travellers"
              >
                +
              </button>
            </div>
          </div>

          <div className="search-widget-actions">
            <button
              type="button"
              className="sunshine-home-trigger-btn"
              onClick={() => setIsSunshineOpen(true)}
              title="Not sure where to go? Ask Sunshine to match your vibe!"
            >
              ☀️ Ask Sunshine
            </button>
            <button type="submit" className="search-submit-btn">
              Explore Destination ➔
            </button>
          </div>
        </form>

        {error && <p className="home-form-error">{error}</p>}

        <div className="home-popular-row">
          <span className="popular-label">Popular destinations:</span>
          <div className="popular-chips">
            {POPULAR_DESTINATIONS.map((dest) => (
              <button
                key={dest}
                type="button"
                className={`destination-chip ${query.toLowerCase() === dest.toLowerCase() ? "active" : ""}`}
                onClick={() => handleChipClick(dest)}
              >
                📍 {dest}
              </button>
            ))}
          </div>
        </div>

        <SunshineHomeModal
          isOpen={isSunshineOpen}
          onClose={() => setIsSunshineOpen(false)}
          onSelectDestination={(dest) => {
            setQuery(dest);
            setTripDates({ startDate, endDate });
            setTravellers(travellerCount);
            navigate(`/destination/${encodeURIComponent(dest)}`);
          }}
        />
      </div>
    </section>
  );
}

