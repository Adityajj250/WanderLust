import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const ARRIVAL_OPTIONS = [
  { id: "train", label: "Train", icon: "🚆", hubType: "Railway Station", desc: "Railway Station / Express Train" },
  { id: "airport", label: "Airport", icon: "✈️", hubType: "Airport", desc: "Flight / Regional Airport" },
  { id: "bus", label: "Bus", icon: "🚌", hubType: "Bus Station", desc: "Intercity Bus Terminal / Stand" },
  { id: "other", label: "Other", icon: "🚗", hubType: "Other", desc: "Self-Drive / Car / City Center" },
];

const CAB_TYPES = [
  { id: "auto", name: "Auto Rickshaw", icon: "🛺", ratePerKm: 16, baseFare: 35 },
  { id: "sedan", name: "Sedan / Mini", icon: "🚗", ratePerKm: 22, baseFare: 70 },
  { id: "suv", name: "SUV / Prime", icon: "🚙", ratePerKm: 32, baseFare: 120 },
];

export default function TripPlannerWizard({
  destination,
  transportHubs = [],
  hotels = [],
  attractions = [],
  hotelDistances = [],
  onSelectArrivalPoint,
  onSelectHotel,
  onFilterHotels,
  onExit,
}) {
  const [currentStep, setCurrentStep] = useState(1); // 1: Arrival, 2: Hotel & Cab, 3: Tickets
  const [arrivalOption, setArrivalOption] = useState(null); // 'train' | 'airport' | 'bus' | 'other'
  const [selectedHub, setSelectedHub] = useState(null);

  // Step 2: Price filtering & hotel selection
  const [priceFilter, setPriceFilter] = useState("all"); // 'all' | 'budget' | 'moderate' | 'luxury'
  const [bookedHotel, setBookedHotel] = useState(null);
  const [selectedCab, setSelectedCab] = useState("sedan");
  const [cabBooked, setCabBooked] = useState(false);

  // Step 3: Attraction tickets
  const [selectedTickets, setSelectedTickets] = useState({});
  const [ticketsConfirmed, setTicketsConfirmed] = useState(false);

  const navigate = useNavigate();

  // Filter hotels based on price filter
  const filteredHotels = useMemo(() => {
    return hotels.filter((h) => {
      const p = h.pricePerNight || 0;
      if (priceFilter === "budget") return p < 2500;
      if (priceFilter === "moderate") return p >= 2500 && p <= 4500;
      if (priceFilter === "luxury") return p > 4500;
      return true;
    });
  }, [hotels, priceFilter]);

  // Notify parent of filtered hotels whenever filter changes
  React.useEffect(() => {
    if (onFilterHotels) {
      onFilterHotels(filteredHotels);
    }
  }, [filteredHotels, onFilterHotels]);

  // Handle Arrival Option Selection
  function handleArrivalSelect(option) {
    setArrivalOption(option.id);

    let hub = null;
    if (option.hubType === "Other") {
      hub = {
        name: `${destination.displayName.split(",")[0]} City Center Entry`,
        type: "Other",
        lat: destination.lat,
        lon: destination.lon,
      };
    } else {
      hub = transportHubs.find((h) => h.type === option.hubType);
      if (!hub) {
        // Fallback: look for bus stop if bus station not found
        if (option.id === "bus") {
          hub = transportHubs.find((h) => h.type === "Bus Stop");
        }
      }
      if (!hub) {
        // Fallback to destination center coordinates with descriptive name
        hub = {
          name: `${destination.displayName.split(",")[0]} ${option.label} Hub`,
          type: option.hubType,
          lat: destination.lat + 0.015,
          lon: destination.lon + 0.015,
        };
      }
    }

    setSelectedHub(hub);
    if (onSelectArrivalPoint) {
      onSelectArrivalPoint(hub);
    }
  }

  // Handle Hotel Selection in Step 2
  function handleSelectHotelClick(hotel) {
    setBookedHotel(hotel);
    setCabBooked(false);
    if (onSelectHotel) {
      onSelectHotel(hotel);
    }
  }

  // Estimate cab fare from arrival hub to booked hotel
  const hotelDistEntry = useMemo(() => {
    if (!bookedHotel) return null;
    return hotelDistances.find(
      (d) => d.name === bookedHotel.name || d.id === (bookedHotel._id || bookedHotel.osmId)
    );
  }, [bookedHotel, hotelDistances]);

  const estDistanceKm = hotelDistEntry?.distanceKm || 6.5;

  function calculateCabFare(cab) {
    return Math.round(cab.baseFare + estDistanceKm * cab.ratePerKm);
  }

  // Handle Ticket quantity change
  function handleTicketToggle(attractionId, price) {
    setSelectedTickets((prev) => {
      const current = prev[attractionId];
      if (current) {
        const copy = { ...prev };
        delete copy[attractionId];
        return copy;
      }
      return { ...prev, [attractionId]: { qty: 1, price } };
    });
  }

  function handleQtyChange(attractionId, delta) {
    setSelectedTickets((prev) => {
      const current = prev[attractionId];
      if (!current) return prev;
      const newQty = Math.max(1, current.qty + delta);
      return { ...prev, [attractionId]: { ...current, qty: newQty } };
    });
  }

  const totalTicketsCost = useMemo(() => {
    return Object.values(selectedTickets).reduce((sum, item) => sum + item.qty * item.price, 0);
  }, [selectedTickets]);

  return (
    <div className="trip-wizard-card">
      <div className="wizard-header">
        <div className="wizard-title-wrap">
          <span className="wizard-step-badge">Step {currentStep} of 3</span>
          <h3>
            {currentStep === 1 && "How do you want to arrive?"}
            {currentStep === 2 && "Choose Hotel & Book Cab"}
            {currentStep === 3 && "Book Tourist Spot Tickets"}
          </h3>
        </div>
        <button className="wizard-exit-btn" onClick={onExit} title="Exit guided trip planner">
          ✕ Exit Planner
        </button>
      </div>

      {/* Progress Bar */}
      <div className="wizard-progress-bar">
        <div
          className={`progress-step ${currentStep >= 1 ? "active" : ""}`}
          onClick={() => setCurrentStep(1)}
        >
          1. Arrival
        </div>
        <div
          className={`progress-step ${currentStep >= 2 ? "active" : ""}`}
          onClick={() => arrivalOption && setCurrentStep(2)}
        >
          2. Hotel & Cab
        </div>
        <div
          className={`progress-step ${currentStep >= 3 ? "active" : ""}`}
          onClick={() => bookedHotel && setCurrentStep(3)}
        >
          3. Tickets
        </div>
      </div>

      {/* ── STEP 1: Arrival Selection ───────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="wizard-step-content">
          <p className="wizard-instruction">
            Select how you'll arrive in <strong>{destination.displayName.split(",")[0]}</strong>.
            We will plot your arrival terminal and draw road routes to nearby accommodations.
          </p>

          <div className="arrival-options-grid">
            {ARRIVAL_OPTIONS.map((opt) => {
              const isSelected = arrivalOption === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`arrival-option-card ${isSelected ? "selected" : ""}`}
                  onClick={() => handleArrivalSelect(opt)}
                >
                  <span className="arrival-icon">{opt.icon}</span>
                  <div className="arrival-text">
                    <span className="arrival-title">{opt.label}</span>
                    <span className="arrival-desc">{opt.desc}</span>
                  </div>
                  {isSelected && <span className="check-mark">✓</span>}
                </button>
              );
            })}
          </div>

          {selectedHub && (
            <div className="selected-hub-alert">
              <span className="hub-alert-icon">📍</span>
              <div>
                <strong>Arrival Hub Selected:</strong> {selectedHub.name}
                <div className="hub-alert-sub">
                  Road paths to {hotels.length} hotels are now mapped on the left!
                </div>
              </div>
            </div>
          )}

          <div className="wizard-footer-actions">
            <button
              type="button"
              className="primary wizard-next-btn"
              disabled={!arrivalOption}
              onClick={() => setCurrentStep(2)}
            >
              Next: Select Hotel & Cab ➔
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Hotel Selection, Price Filter & Taxi Booking ────────────── */}
      {currentStep === 2 && (
        <div className="wizard-step-content">
          {/* Price Filter */}
          <div className="price-filter-section">
            <label className="price-filter-label">Filter Hotels by Budget:</label>
            <div className="price-filter-buttons">
              <button
                type="button"
                className={`filter-chip ${priceFilter === "all" ? "active" : ""}`}
                onClick={() => setPriceFilter("all")}
              >
                All ({hotels.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${priceFilter === "budget" ? "active" : ""}`}
                onClick={() => setPriceFilter("budget")}
              >
                Budget &lt; ₹2.5k
              </button>
              <button
                type="button"
                className={`filter-chip ${priceFilter === "moderate" ? "active" : ""}`}
                onClick={() => setPriceFilter("moderate")}
              >
                ₹2.5k - ₹4.5k
              </button>
              <button
                type="button"
                className={`filter-chip ${priceFilter === "luxury" ? "active" : ""}`}
                onClick={() => setPriceFilter("luxury")}
              >
                Luxury &gt; ₹4.5k
              </button>
            </div>
          </div>

          {/* Hotel List */}
          <div className="wizard-hotel-list">
            <h4>Select Your Hotel ({filteredHotels.length} available)</h4>
            <div className="wizard-cards-scroll">
              {filteredHotels.map((h) => {
                const isSelected =
                  (bookedHotel?._id || bookedHotel?.osmId || bookedHotel?.name) ===
                  (h._id || h.osmId || h.name);
                const dist = hotelDistances.find(
                  (d) => d.name === h.name || d.id === (h._id || h.osmId)
                );

                return (
                  <div
                    key={h._id || h.osmId || h.name}
                    className={`wizard-hotel-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectHotelClick(h)}
                  >
                    <div className="wizard-hotel-info">
                      <h5>{h.name}</h5>
                      <span className="wizard-hotel-price">
                        ₹{h.pricePerNight?.toLocaleString("en-IN")} / night
                      </span>
                      {dist && (
                        <span className="dist-chip">
                          🚗 {dist.distanceKm} km via road from arrival hub
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`select-btn ${isSelected ? "selected" : ""}`}
                    >
                      {isSelected ? "Selected ✓" : "Choose Hotel"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Taxi / Cab Booking Section */}
          {bookedHotel && (
            <div className="taxi-booking-card">
              <div className="taxi-header">
                <span className="taxi-icon">🚕</span>
                <div>
                  <h4>Book Airport/Station Cab to Hotel</h4>
                  <p>
                    From <strong>{selectedHub?.name}</strong> to <strong>{bookedHotel.name}</strong> (~{estDistanceKm} km)
                  </p>
                </div>
              </div>

              {!cabBooked ? (
                <div className="cab-options-wrap">
                  <div className="cab-options-grid">
                    {CAB_TYPES.map((cab) => {
                      const fare = calculateCabFare(cab);
                      const isChosen = selectedCab === cab.id;
                      return (
                        <button
                          key={cab.id}
                          type="button"
                          className={`cab-option-tile ${isChosen ? "chosen" : ""}`}
                          onClick={() => setSelectedCab(cab.id)}
                        >
                          <span className="cab-icon">{cab.icon}</span>
                          <span className="cab-name">{cab.name}</span>
                          <span className="cab-fare">₹{fare}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="primary book-cab-btn"
                    onClick={() => setCabBooked(true)}
                  >
                    🚕 Confirm Cab Booking (₹{calculateCabFare(CAB_TYPES.find((c) => c.id === selectedCab))})
                  </button>
                </div>
              ) : (
                <div className="cab-confirmed-badge">
                  <span className="success-icon">✓</span>
                  <div>
                    <strong>Cab Confirmed!</strong> Driver will meet you at {selectedHub?.name}.
                    <div className="cab-fare-note">
                      Vehicle: {CAB_TYPES.find((c) => c.id === selectedCab)?.name} · Estimated Fare: ₹
                      {calculateCabFare(CAB_TYPES.find((c) => c.id === selectedCab))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="wizard-footer-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setCurrentStep(1)}
            >
              ← Back to Arrival
            </button>
            <button
              type="button"
              className="primary wizard-next-btn"
              disabled={!bookedHotel}
              onClick={() => setCurrentStep(3)}
            >
              Next: Tourist Spot Tickets ➔
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Tourist Spot Tickets or Skip ─────────────────────────────── */}
      {currentStep === 3 && (
        <div className="wizard-step-content">
          <p className="wizard-instruction">
            Pre-book tickets for popular monuments and attractions to skip the lines, or skip this step to finish your trip.
          </p>

          {!ticketsConfirmed ? (
            <>
              <div className="attraction-tickets-list">
                {attractions.slice(0, 8).map((a, idx) => {
                  const isPlaceOfWorship = a.category === "Place of Worship";
                  const isBeach = a.category === "Beach" || a.category === "Park & Nature";
                  // Realistic ticket prices: beaches/temples usually free or minimal entry fee
                  const ticketPrice = isPlaceOfWorship || isBeach ? 0 : 50 + (idx % 4) * 50;
                  const item = selectedTickets[a._id || a.osmId || a.name];
                  const isSelected = !!item;

                  return (
                    <div
                      key={a._id || a.osmId || a.name}
                      className={`ticket-item-row ${isSelected ? "selected" : ""}`}
                    >
                      <div className="ticket-item-checkbox">
                        <input
                          type="checkbox"
                          id={`ticket-${idx}`}
                          checked={isSelected}
                          onChange={() =>
                            handleTicketToggle(a._id || a.osmId || a.name, ticketPrice)
                          }
                        />
                        <label htmlFor={`ticket-${idx}`}>
                          <strong>{a.name}</strong>
                          <span className="badge">{a.category}</span>
                        </label>
                      </div>

                      <div className="ticket-pricing-controls">
                        <span className="ticket-price-tag">
                          {ticketPrice === 0 ? "Free Entry" : `₹${ticketPrice}/person`}
                        </span>
                        {isSelected && ticketPrice > 0 && (
                          <div className="qty-stepper">
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(a._id || a.osmId || a.name, -1)
                              }
                            >
                              -
                            </button>
                            <span>{item.qty}</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(a._id || a.osmId || a.name, 1)
                              }
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total & Booking Confirmation */}
              <div className="tickets-summary-card">
                <div className="total-row">
                  <span>Selected Attractions:</span>
                  <strong>{Object.keys(selectedTickets).length}</strong>
                </div>
                <div className="total-row grand-total">
                  <span>Total Tickets Cost:</span>
                  <strong>₹{totalTicketsCost}</strong>
                </div>

                <div className="tickets-action-buttons">
                  <button
                    type="button"
                    className="primary confirm-tickets-btn"
                    disabled={Object.keys(selectedTickets).length === 0}
                    onClick={() => setTicketsConfirmed(true)}
                  >
                    🎟️ Confirm & Book Tickets (₹{totalTicketsCost})
                  </button>
                  <button
                    type="button"
                    className="secondary skip-home-btn"
                    onClick={() => navigate("/")}
                  >
                    Skip & Return to Home 🏠
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="tickets-confirmed-view">
              <div className="confirmation-banner">
                <span className="big-check">🎉</span>
                <h4>Trip Booked Successfully!</h4>
                <p>
                  Your trip to <strong>{destination.displayName.split(",")[0]}</strong> is ready.
                </p>
              </div>

              <div className="trip-recap-card">
                <div className="recap-item">
                  <span>📍 Arrival Terminal:</span>
                  <strong>{selectedHub?.name}</strong>
                </div>
                <div className="recap-item">
                  <span>🏨 Hotel:</span>
                  <strong>{bookedHotel?.name}</strong>
                </div>
                {cabBooked && (
                  <div className="recap-item">
                    <span>🚕 Cab Pickup:</span>
                    <strong>{CAB_TYPES.find((c) => c.id === selectedCab)?.name} Confirmed</strong>
                  </div>
                )}
                <div className="recap-item">
                  <span>🎟️ Attractions Booked:</span>
                  <strong>{Object.keys(selectedTickets).length} places (₹{totalTicketsCost})</strong>
                </div>
              </div>

              <button
                type="button"
                className="primary finish-home-btn"
                onClick={() => navigate("/")}
              >
                🏠 Return to Homepage
              </button>
            </div>
          )}

          <div className="wizard-footer-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setCurrentStep(2)}
            >
              ← Back to Hotel & Cab
            </button>
            {!ticketsConfirmed && (
              <button
                type="button"
                className="skip-link-btn"
                onClick={() => navigate("/")}
              >
                Skip & Return to Home
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
