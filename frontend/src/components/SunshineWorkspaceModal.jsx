import React, { useState, useEffect, useRef } from "react";
import { askSunshineWorkspace } from "../api/api.js";
import { useTrip } from "../context/TripContext.jsx";

export default function SunshineWorkspaceModal({
  isOpen,
  onClose,
  destination,
  weather,
  attractions = [],
  hotels = [],
  transportHubs = [],
  onApplyItinerary,
}) {
  const { trip, addAttraction, setIsPlanning } = useTrip();

  const cityName = destination?.displayName?.split(",")[0]?.trim() || destination?.query || "Destination";
  const weatherText = weather ? `${weather.temp}°C, ${weather.condition?.label || "Clear"}` : "Weather loading...";

  const initialGreeting = `Yo! **Sunshine** here ☀️! I'm fully tuned into everything on your screen for **${cityName}**!

🌡️ **Live Weather:** ${weatherText}
🏛️ **Loaded:** ${attractions.length} sights, ${hotels.length} hotels, and ${transportHubs.length} transit stations.

Ask me anything about these spots, hotel recommendations, or transit connections!

💡 **Pro-Tip:** Whenever you're ready for a full day-by-day itinerary, just type: '**Plan for me**' and I'll craft a custom plan using strictly the real places on your screen!`;

  const [messages, setMessages] = useState([
    {
      role: "model",
      content: initialGreeting,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Update initial message when destination or weather changes and there is only 1 message
  useEffect(() => {
    if (messages.length <= 1) {
      setMessages([
        {
          role: "model",
          content: initialGreeting,
        },
      ]);
    }
  }, [destination, weather, attractions.length, hotels.length]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const quickPrompts = [
    { label: "⚡ Plan for me", text: "Plan for me" },
    { label: "🌡️ Weather & Packing", text: "What's the weather like right now and what should I wear or pack?" },
    { label: "🏨 Recommend Hotel", text: "Which of these hotels offers the best location and value?" },
    { label: "🏛️ Top Sights", text: "Which 3 to 4 attractions from the list are absolute must-visits?" },
  ];

  async function sendMessage(textToSend) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setInput("");
    setError("");

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    const screenContext = {
      destination: destination?.displayName || destination?.query || cityName,
      weather: weather
        ? {
            temp: weather.temp,
            condition: weather.condition?.label,
            humidity: weather.humidity,
            summary: weather.advice?.text,
          }
        : null,
      attractions: attractions.map((a) => ({
        name: a.name,
        category: a.category,
        priority: a.priority,
        score: a.score,
      })),
      hotels: hotels.map((h) => ({
        name: h.name,
        type: h.type,
        pricePerNight: h.pricePerNight,
        rating: h.rating,
        locationScore: h.locationScore,
      })),
      transportHubs: transportHubs.map((t) => ({
        name: t.name,
        type: t.type,
      })),
      trip: {
        durationDays: trip.durationDays || 3,
        travellers: trip.travellers || 1,
        selectedAttractions: trip.selectedAttractions,
        selectedHotel: trip.selectedHotel,
        arrivalHub: trip.arrivalHub,
        selectedCab: trip.selectedCab,
      },
    };

    try {
      const data = await askSunshineWorkspace({
        messages: newMessages,
        screenContext,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: data.text,
          isItinerary: data.isItinerary,
          recommendedPlaces: data.recommendedPlaces || [],
        },
      ]);
    } catch (err) {
      console.error(err);
      setError("Sunshine hit a snag. Try asking again!");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleApplyToTrip(recommendedPlaceNames = []) {
    // Match recommended place names to real attractions on screen
    const matched = [];
    recommendedPlaceNames.forEach((name) => {
      const cleanName = name.toLowerCase().trim();
      const found = attractions.find(
        (a) =>
          a.name.toLowerCase().includes(cleanName) ||
          cleanName.includes(a.name.toLowerCase())
      );
      if (found && !matched.some((m) => m._id === found._id || m.osmId === found.osmId)) {
        matched.push(found);
      }
    });

    // If no exact fuzzy matches found, use top available attractions
    const toAdd = matched.length > 0 ? matched : attractions.slice(0, 4);

    toAdd.forEach((attraction) => {
      addAttraction(attraction);
    });

    setIsPlanning(true);
    if (onApplyItinerary) onApplyItinerary(toAdd);
    onClose();
  }

  return (
    <div className="modal-backdrop sunshine-modal-backdrop" onClick={onClose}>
      <div className="sunshine-modal-window workspace-sunshine-window" onClick={(e) => e.stopPropagation()}>
        {/* Header with Live Screen Awareness */}
        <div className="sunshine-modal-header">
          <div className="sunshine-avatar-wrap">
            <span className="sunshine-avatar-icon">☀️</span>
            <div className="sunshine-avatar-info">
              <div className="sunshine-title-row">
                <h3>Ask Sunshine</h3>
                <span className="sunshine-badge-live">Live Screen Aware</span>
              </div>
              <p className="sunshine-tagline">
                Tuned into <strong>{cityName}</strong> · {weatherText}
              </p>
            </div>
          </div>
          <button type="button" className="sunshine-close-btn" onClick={onClose} aria-label="Close Sunshine">
            ✕
          </button>
        </div>

        {/* Screen Awareness Ribbon */}
        <div className="sunshine-screen-ribbon">
          <span className="ribbon-item">📍 {cityName}</span>
          <span className="ribbon-item">🌡️ {weather ? `${weather.temp}°C` : "--"}</span>
          <span className="ribbon-item">🏛️ {attractions.length} OSM Sights</span>
          <span className="ribbon-item">🏨 {hotels.length} OSM Hotels</span>
          <span className="ribbon-item">🚆 {transportHubs.length} Stations</span>
        </div>

        {/* Quick Action Chips */}
        <div className="sunshine-quick-vibes-bar">
          <span className="quick-vibes-label">Ask Sunshine:</span>
          <div className="quick-vibes-list">
            {quickPrompts.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`quick-vibe-pill ${p.label.includes("Plan") ? "highlight-plan" : ""}`}
                onClick={() => sendMessage(p.text)}
                disabled={loading}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Messages Body */}
        <div className="sunshine-chat-body">
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <div key={idx} className={`sunshine-message-row ${isUser ? "user-row" : "sunshine-row"}`}>
                {!isUser && <span className="message-avatar">☀️</span>}
                <div className={`sunshine-bubble ${isUser ? "user-bubble" : "sunshine-bubble-model"}`}>
                  <div className="bubble-text">
                    {m.content.split("\n").map((line, lIdx) => {
                      if (!line.trim()) return <br key={lIdx} />;
                      // Render markdown headers simply
                      if (line.startsWith("### ")) {
                        return <h4 key={lIdx} style={{ margin: "8px 0 4px", color: "var(--primary)" }}>{line.replace("### ", "")}</h4>;
                      }
                      if (line.startsWith("## ")) {
                        return <h3 key={lIdx} style={{ margin: "10px 0 6px" }}>{line.replace("## ", "")}</h3>;
                      }
                      if (line.startsWith("# ")) {
                        return <h2 key={lIdx} style={{ margin: "12px 0 8px" }}>{line.replace("# ", "")}</h2>;
                      }
                      return <p key={lIdx}>{line}</p>;
                    })}
                  </div>

                  {/* If this message is a generated Itinerary with recommended OSM places */}
                  {m.isItinerary && m.recommendedPlaces && m.recommendedPlaces.length > 0 && (
                    <div className="itinerary-apply-card">
                      <div className="itinerary-apply-header">
                        <span className="apply-icon">✨</span>
                        <div>
                          <strong>Custom Itinerary Grounded in OSM Places</strong>
                          <p>Sunshine selected {m.recommendedPlaces.length} real places from your screen.</p>
                        </div>
                      </div>
                      <div className="itinerary-places-tags">
                        {m.recommendedPlaces.map((p, pIdx) => (
                          <span key={pIdx} className="itinerary-place-tag">
                            ✦ {p}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="itinerary-apply-btn"
                        onClick={() => handleApplyToTrip(m.recommendedPlaces)}
                      >
                        🗺️ Apply to Trip Plan & Open Map ➔
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="sunshine-message-row sunshine-row">
              <span className="message-avatar">☀️</span>
              <div className="sunshine-bubble sunshine-bubble-model typing-bubble">
                <span className="sunshine-typing-indicator">
                  Sunshine is analyzing your screen & crafting response<span>.</span><span>.</span><span>.</span>
                </span>
              </div>
            </div>
          )}

          {error && <div className="sunshine-error-toast">{error}</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input */}
        <div className="sunshine-input-footer">
          <input
            ref={inputRef}
            type="text"
            className="sunshine-text-input"
            placeholder="Ask Sunshine or type 'Plan for me'..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="sunshine-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            Ask ➔
          </button>
        </div>
      </div>
    </div>
  );
}
