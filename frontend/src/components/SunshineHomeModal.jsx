import React, { useState, useEffect, useRef } from "react";
import { askSunshineHome } from "../api/api.js";

const QUICK_VIBES = [
  { icon: "🏖️", label: "Beach & Chill", prompt: "I want chill beach vibes, sunset cafes, and ocean breeze." },
  { icon: "🏔️", label: "Mountain Escapes", prompt: "I'm craving crisp mountain air, scenic views, and cozy vibes." },
  { icon: "🏰", label: "Heritage & Forts", prompt: "Looking for historic forts, palaces, and royal cultural stories." },
  { icon: "🍛", label: "Epic Food Trails", prompt: "I want unforgettable street food, authentic delicacies, and local markets." },
  { icon: "🎉", label: "Party with Friends", prompt: "Looking for vibrant nightlife, fun beach clubs, and party vibes on a budget." },
  { icon: "🌿", label: "Offbeat Nature", prompt: "Want peaceful greenery, waterfalls, and untouched nature away from the crowd." },
];

export default function SunshineHomeModal({ isOpen, onClose, onSelectDestination }) {
  const [messages, setMessages] = useState([
    {
      role: "model",
      content:
        "Yo! What's up traveler? I'm **Sunshine** ☀️, your personal vibe-finder!\n\nTell me what mood you're in—craving golden beaches, snowy mountain highs, crazy good food trails, quiet spiritual vibes, or wild parties?\n\n**What's the vibe like today?**",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  async function sendMessage(textToSend) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setInput("");
    setError("");

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const data = await askSunshineHome({ messages: newMessages });
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          content: data.text,
          suggestedDestinations: data.suggestedDestinations || [],
        },
      ]);
    } catch (err) {
      console.error(err);
      setError("Sunshine got a little disconnected. Hit send again, bro!");
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

  function handleDestinationClick(dest) {
    if (onSelectDestination) {
      onSelectDestination(dest);
    }
    onClose();
  }

  return (
    <div className="modal-backdrop sunshine-modal-backdrop" onClick={onClose}>
      <div className="sunshine-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sunshine-modal-header">
          <div className="sunshine-avatar-wrap">
            <span className="sunshine-avatar-icon">☀️</span>
            <div className="sunshine-avatar-info">
              <div className="sunshine-title-row">
                <h3>Ask Sunshine</h3>
                <span className="sunshine-badge">Vibe Matcher</span>
              </div>
              <p className="sunshine-tagline">Your chill dude guide to finding the perfect place</p>
            </div>
          </div>
          <button type="button" className="sunshine-close-btn" onClick={onClose} aria-label="Close Sunshine">
            ✕
          </button>
        </div>

        {/* Quick Vibe Chips */}
        <div className="sunshine-quick-vibes-bar">
          <span className="quick-vibes-label">Quick Vibes:</span>
          <div className="quick-vibes-list">
            {QUICK_VIBES.map((v) => (
              <button
                key={v.label}
                type="button"
                className="quick-vibe-pill"
                onClick={() => sendMessage(v.prompt)}
                disabled={loading}
              >
                <span>{v.icon}</span> {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History */}
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
                      // Clean bracket tags if shown to user
                      const displayLine = line.replace(/\[Destination:\s*[^\]]+\]/g, "");
                      return <p key={lIdx}>{displayLine}</p>;
                    })}
                  </div>

                  {/* If destinations were suggested, render tap-to-select pills */}
                  {m.suggestedDestinations && m.suggestedDestinations.length > 0 && (
                    <div className="suggested-dest-cards-grid">
                      <span className="suggested-dest-title">Tap to explore this spot:</span>
                      <div className="suggested-dest-pills">
                        {m.suggestedDestinations.map((dest) => (
                          <button
                            key={dest}
                            type="button"
                            className="suggested-dest-btn"
                            onClick={() => handleDestinationClick(dest)}
                          >
                            📍 Explore <strong>{dest}</strong> ➔
                          </button>
                        ))}
                      </div>
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
                  Sunshine is catching the vibe<span>.</span><span>.</span><span>.</span>
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
            placeholder="Tell Sunshine what kind of trip you're feeling..."
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
