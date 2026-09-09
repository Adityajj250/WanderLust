import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTrip } from "../context/TripContext.jsx";

const POPULAR_DESTINATIONS = ["Udupi", "Goa", "Mysuru", "Manali"];

export default function Home() {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const { openAiModal } = useTrip();
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Please enter a destination name.");
      return;
    }
    setError("");
    navigate(`/destination/${encodeURIComponent(trimmed)}`);
  }

  function handleChipClick(dest) {
    navigate(`/destination/${encodeURIComponent(dest)}`);
  }

  return (
    <section className="home-hero-section">
      <div className="home-hero-container">
        <h1 className="home-hero-title">Where do you want to explore?</h1>
        <p className="home-hero-subtitle">
          Discover top sights, optimize where to stay by location, and plan your entire journey in minutes.
        </p>

        <form className="home-search-bar" onSubmit={handleSubmit}>
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search a city or place (e.g. Udupi, Goa, Paris)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Destination search"
              autoFocus
            />
          </div>
          <button type="submit" className="search-submit-btn">
            Explore
          </button>
        </form>

        {error && <p className="home-form-error">{error}</p>}

        <div className="home-popular-row">
          <span className="popular-label">Popular destinations:</span>
          <div className="popular-chips">
            {POPULAR_DESTINATIONS.map((dest) => (
              <button
                key={dest}
                type="button"
                className="destination-chip"
                onClick={() => handleChipClick(dest)}
              >
                📍 {dest}
              </button>
            ))}
          </div>
        </div>

        <div className="home-ai-divider">
          <span className="divider-line" />
          <span className="divider-text">OR</span>
          <span className="divider-line" />
        </div>

        <div className="home-ai-action">
          <button
            type="button"
            className="home-ai-primary-btn"
            onClick={() => openAiModal(query.trim())}
          >
            ✨ Plan My Trip with AI
          </button>
          <p className="home-ai-hint">
            Let AI craft a custom day-by-day plan and map it instantly.
          </p>
        </div>
      </div>
    </section>
  );
}

