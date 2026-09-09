import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateAiTripPlan } from "../api/api.js";
import { useTrip } from "../context/TripContext.jsx";
import AiItineraryView from "./AiItineraryView.jsx";

const POPULAR_INTERESTS = [
  "🏖️ Beaches",
  "🏛️ Temples",
  "🍛 Food & Dining",
  "📸 Photography",
  "🏰 History",
  "🌲 Nature",
  "🎉 Nightlife",
];

export default function AiTripModal({ isOpen, onClose, initialDestination = "" }) {
  const [destination, setDestination] = useState(initialDestination);
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState("Moderate");
  const [selectedInterests, setSelectedInterests] = useState(["🏖️ Beaches", "🏛️ Temples", "🍛 Food & Dining"]);
  const [customInterest, setCustomInterest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const { setDurationDays, setIsPlanning } = useTrip();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialDestination) {
      setDestination(initialDestination);
    }
  }, [initialDestination]);

  if (!isOpen) return null;

  function toggleInterest(interest) {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  async function handleGenerate(e) {
    e.preventDefault();
    const dest = destination.trim();
    if (!dest) {
      setError("Please enter a destination name.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    const combinedInterests = [
      ...selectedInterests.map((s) => s.replace(/^[^\s]+\s*/, "")), // clean emoji
      customInterest.trim(),
    ]
      .filter(Boolean)
      .join(", ");

    try {
      const data = await generateAiTripPlan({
        destination: dest,
        days: Number(days),
        interests: combinedInterests || "Sightseeing & Culture",
        budget,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || "Failed to generate AI itinerary.");
    } finally {
      setLoading(false);
    }
  }

  function handleBuildTripOnMap() {
    if (!result?.destination) return;

    // Save recommended places and duration to session for auto-selection in Destination workspace
    const placesToPass = result.recommendedPlaces || [];
    try {
      sessionStorage.setItem("ai_preselect_places", JSON.stringify(placesToPass));
    } catch (_) {}

    setDurationDays(Number(days) || 3);
    setIsPlanning(true);
    onClose();

    // Navigate to destination with mode=plan
    navigate(`/destination/${encodeURIComponent(result.destination)}?mode=plan`);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-content ai-modal ${result ? "ai-modal-expanded" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!result && (
          <div className="modal-header">
            <div className="modal-title-wrap">
              <span className="modal-icon">✨</span>
              <div>
                <h3>WanderLust AI Planner</h3>
                <p className="modal-subtitle">Instant day-by-day plan crafted for your travel style</p>
              </div>
            </div>
            <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>
        )}

        <div className={`modal-body ${result ? "modal-body-itinerary" : ""}`}>
          {!result && (
            <form onSubmit={handleGenerate} className="ai-form">
              <div className="form-group">
                <label htmlFor="ai-destination">Destination</label>
                <input
                  id="ai-destination"
                  type="text"
                  placeholder="e.g. Udupi, Goa, Mysuru, Paris"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ai-days">Duration</label>
                  <select
                    id="ai-days"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  >
                    <option value={1}>1 Day (Quick Stop)</option>
                    <option value={2}>2 Days (Weekend Trip)</option>
                    <option value={3}>3 Days (Recommended)</option>
                    <option value={4}>4 Days (Relaxed Tour)</option>
                    <option value={5}>5 Days (In-Depth)</option>
                    <option value={7}>7 Days (Full Week)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ai-budget">Budget Style</label>
                  <select
                    id="ai-budget"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option value="Budget">Budget</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Luxury">Luxury</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Interests & Travel Vibes</label>
                <div className="interest-chips-wrap">
                  {POPULAR_INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        className={`interest-chip ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleInterest(interest)}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Other interests (optional, e.g. local handicraft markets)"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  className="custom-interest-input"
                />
              </div>

              {error && <div className="form-error">{error}</div>}

              <button
                type="submit"
                className="ai-generate-btn"
                disabled={loading || !destination.trim()}
              >
                {loading ? (
                  <span className="btn-spinner">✨ Crafting your custom itinerary...</span>
                ) : (
                  "✨ Generate Day-by-Day Itinerary"
                )}
              </button>
            </form>
          )}

          {result && (
            <AiItineraryView
              result={result}
              onBuildTripOnMap={handleBuildTripOnMap}
              onBack={() => setResult(null)}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

