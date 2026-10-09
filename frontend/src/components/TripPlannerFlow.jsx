import React, { useState, useMemo, useEffect } from "react";
import { useTrip } from "../context/TripContext.jsx";
import { computeHotelLocationScores } from "../utils/locationScore.js";

const LOCAL_TRANSPORT_PACKAGES = [
  {
    id: "none",
    name: "None (Self Transport)",
    icon: "🚶",
    price: 0,
    rateText: "Free (₹0)",
    detail: "Arrange your own transport · Walk, metro, or local taxi",
  },
  {
    id: "auto-4h",
    name: "Auto-Rickshaw / Local Cab",
    icon: "🛺",
    price: 1000,
    rateText: "₹1,000 / 4 hrs (40 km)",
    detail: "Short hops between hotel & nearby sights · Ideal for quick visits",
  },
  {
    id: "compact-8h",
    name: "Compact Car (Hatchback)",
    icon: "🚗",
    price: 2000,
    rateText: "₹2,000 / 8 hrs/day (80 km)",
    detail: "AC Hatchback · Up to 4 passengers · Dedicated driver for full day",
  },
  {
    id: "sedan-8h",
    name: "Comfort Sedan (Dzire / Etios)",
    icon: "🚘",
    price: 2800,
    rateText: "₹2,800 / 8 hrs/day (80 km)",
    detail: "AC Sedan · Extra luggage space · Dedicated driver for full day",
  },
  {
    id: "suv-8h",
    name: "Prime SUV (Innova / Ertiga)",
    icon: "🚙",
    price: 3800,
    rateText: "₹3,800 / 8 hrs/day (80 km)",
    detail: "6-7 seater SUV · Ultimate comfort for group/family sightseeing",
  },
];

const HOTEL_PRICE_FILTERS = [
  { id: "all", label: "All Prices" },
  { id: "under-2500", label: "Under ₹2,500", max: 2500 },
  { id: "under-4000", label: "Under ₹4,000", max: 4000 },
  { id: "under-6000", label: "Under ₹6,000", max: 6000 },
];

import { SIGHT_CATEGORIES as SIGHT_CATEGORY_FILTERS, categorizeAttraction } from "../utils/categories.js";

export default function TripPlannerFlow({
  destination,
  attractions = [],
  hotels = [],
  transportHubs = [],
  onExitPlanning,
  onFocusMap,
  onSelectHotel,
  showAddMorePlaces,
  setShowAddMorePlaces,
  isChangingHotel,
  setIsChangingHotel,
  onOpenBooking,
  isFullTripMapOpen = false,
  onToggleFullTripMap,
  onOpenSunshine,
}) {
  const {
    trip,
    setDurationDays,
    addAttraction,
    removeAttraction,
    toggleAttraction,
    clearAttractions,
    selectHotel,
    selectArrivalHub,
    selectCab,
    updateTickets,
    setCurrentPlanStep,
    setIsPlanning,
  } = useTrip();

  const step = trip.currentPlanStep || 1;

  // Local state fallbacks if not controlled by parent
  const [localShowAddMorePlaces, setLocalShowAddMorePlaces] = useState(false);
  const [localIsChangingHotel, setLocalIsChangingHotel] = useState(false);

  const activeShowAddMorePlaces = showAddMorePlaces !== undefined ? showAddMorePlaces : localShowAddMorePlaces;
  const setActiveShowAddMorePlaces = setShowAddMorePlaces || setLocalShowAddMorePlaces;

  const activeIsChangingHotel = isChangingHotel !== undefined ? isChangingHotel : localIsChangingHotel;
  const setActiveIsChangingHotel = setIsChangingHotel || setLocalIsChangingHotel;

  // Local state for Step 1 sights category filter
  const [placesCategoryFilter, setPlacesCategoryFilter] = useState("all");

  // Local state for Step 2 hotel price filter
  const [hotelFilter, setHotelFilter] = useState("all");

  // Local state for Step 3 cab choice
  const [chosenCabId, setChosenCabId] = useState(trip.selectedCab?.id || "none");
  // Selecting a package only saves the choice for the estimate — nothing is booked until the final step.

  // Local state for Step 4 tickets
  // Format: { [attractionKey]: { selected: boolean, visitors: number, price: number, name: string } }
  const [ticketsState, setTicketsState] = useState(() => {
    const initial = {};
    trip.selectedAttractions.forEach((a, idx) => {
      const key = a._id || a.osmId || a.name;
      const isFree =
        a.category === "Place of Worship" ||
        a.category === "Beach" ||
        a.category === "Park & Nature" ||
        a.category === "Nature & Scenic Spot";
      const price = isFree ? 0 : 50 + (idx % 4) * 50;
      initial[key] = {
        selected: true,
        visitors: trip.tickets[key]?.qty || 2,
        price,
        name: a.name,
      };
    });
    return initial;
  });

  // Keep ticketsState synced when trip.selectedAttractions changes
  useEffect(() => {
    setTicketsState((prev) => {
      const updated = { ...prev };
      trip.selectedAttractions.forEach((a, idx) => {
        const key = a._id || a.osmId || a.name;
        if (!updated[key]) {
          const isFree =
            a.category === "Place of Worship" ||
            a.category === "Beach" ||
            a.category === "Park & Nature" ||
            a.category === "Nature & Scenic Spot";
          const price = isFree ? 0 : 50 + (idx % 4) * 50;
          updated[key] = {
            selected: true,
            visitors: trip.tickets[key]?.qty || 2,
            price,
            name: a.name,
          };
        }
      });
      return updated;
    });
  }, [trip.selectedAttractions, trip.tickets]);

  const cityName = destination.displayName.split(",")[0].trim();

  // ─── Multi-Select Places Logic for Step 1 ──────────────────────────────────
  const selectedKeys = useMemo(() => {
    return new Set(trip.selectedAttractions.map((a) => a._id || a.osmId || a.name));
  }, [trip.selectedAttractions]);

  // Sights not yet added to the trip
  const remainingAttractions = useMemo(() => {
    return attractions.filter((a) => !selectedKeys.has(a._id || a.osmId || a.name));
  }, [attractions, selectedKeys]);

  const categoryCounts = useMemo(() => {
    const counts = { all: attractions.length };
    SIGHT_CATEGORY_FILTERS.forEach((cat) => {
      if (cat.id !== "all") {
        counts[cat.id] = attractions.filter((a) => categorizeAttraction(a).id === cat.id).length;
      }
    });
    return counts;
  }, [attractions]);

  const filteredStep1Attractions = useMemo(() => {
    if (placesCategoryFilter === "all") return attractions;
    return attractions.filter((a) => categorizeAttraction(a).id === placesCategoryFilter);
  }, [attractions, placesCategoryFilter]);

  function handleClearAll() {
    clearAttractions();
  }

  function handleToggleAttraction(attraction) {
    toggleAttraction(attraction);
  }

  const [hotelSort, setHotelSort] = useState("score");

  function handleHotelSelection(hotel) {
    const hotelKey = hotel._id || hotel.osmId || hotel.name;
    const currentKey = trip.selectedHotel?._id || trip.selectedHotel?.osmId || trip.selectedHotel?.name;
    if (hotelKey === currentKey) {
      selectHotel(null);
      onSelectHotel?.(null);
      return;
    }
    selectHotel(hotel);
    onSelectHotel?.(hotel);
  }

  // ─── Location Scored Hotels for Step 2 ──────────────────────────────────────
  const scoredHotels = useMemo(() => {
    return computeHotelLocationScores(hotels, trip.selectedAttractions, trip.arrivalHub);
  }, [hotels, trip.selectedAttractions, trip.arrivalHub]);

  const filteredHotels = useMemo(() => {
    let list = scoredHotels.filter((h) => {
      const p = h.pricePerNight || 0;
      if (hotelFilter === "under-2500") return p <= 2500;
      if (hotelFilter === "under-4000") return p <= 4000;
      if (hotelFilter === "under-6000") return p <= 6000;
      return true;
    });

    return list.sort((a, b) => {
      if (hotelSort === "price-asc") return (a.pricePerNight || 0) - (b.pricePerNight || 0);
      if (hotelSort === "price-desc") return (b.pricePerNight || 0) - (a.pricePerNight || 0);
      if (hotelSort === "rating") return (b.rating || 0) - (a.rating || 0);
      return (b.locationScore || 0) - (a.locationScore || 0);
    });
  }, [scoredHotels, hotelFilter, hotelSort]);

  // Ensure default arrival hub if none chosen
  const activeArrivalHub = useMemo(() => {
    if (trip.arrivalHub) return trip.arrivalHub;
    const railway = transportHubs.find((h) => h.type === "Railway Station");
    if (railway) return railway;
    const airport = transportHubs.find((h) => h.type === "Airport");
    if (airport) return airport;
    const bus = transportHubs.find((h) => h.type === "Bus Station" || h.type === "Bus Stop");
    if (bus) return bus;
    return {
      name: `${cityName} City Center Entry`,
      type: "Arrival Terminal",
      lat: destination.lat,
      lon: destination.lon,
    };
  }, [trip.arrivalHub, transportHubs, cityName, destination]);

  // Distance from arrival hub to selected hotel
  const transitDistanceKm = useMemo(() => {
    if (!trip.selectedHotel) return 3.5;
    return trip.selectedHotel.distToArrival || 3.5;
  }, [trip.selectedHotel]);

  function calculateFare(pkg) {
    return pkg?.price || 0;
  }

  // ─── Step 4 Tickets calculations ───────────────────────────────────────────
  function handleTicketVisitorChange(key, delta) {
    setTicketsState((prev) => {
      const curr = prev[key];
      if (!curr) return prev;
      const nextVisitors = Math.max(1, curr.visitors + delta);
      return { ...prev, [key]: { ...curr, visitors: nextVisitors } };
    });
  }

  function handleTicketToggle(key) {
    setTicketsState((prev) => {
      const curr = prev[key];
      if (!curr) return prev;
      return { ...prev, [key]: { ...curr, selected: !curr.selected } };
    });
  }

  const ticketTotal = useMemo(() => {
    return Object.values(ticketsState).reduce((sum, item) => {
      if (!item.selected || item.price === 0) return sum;
      return sum + item.price * item.visitors;
    }, 0);
  }, [ticketsState]);

  // ─── Step Transitions ──────────────────────────────────────────────────────
  function goToStep(s) {
    if (s !== 2) {
      setActiveShowAddMorePlaces(false);
      setActiveIsChangingHotel(false);
    }
    setCurrentPlanStep(s);
  }

  function saveCabChoice(cabId) {
    const cabObj = LOCAL_TRANSPORT_PACKAGES.find((c) => c.id === cabId) || LOCAL_TRANSPORT_PACKAGES[0];
    selectCab({
      ...cabObj,
      fare: calculateFare(cabObj),
      distanceKm: transitDistanceKm,
    });
  }

  function handleConfirmTickets() {
    const formatted = {};
    Object.entries(ticketsState).forEach(([k, v]) => {
      if (v.selected) {
        formatted[k] = { qty: v.visitors, price: v.price, name: v.name };
      }
    });
    updateTickets(formatted);
    goToStep(5);
  }

  function handleSkipTickets() {
    updateTickets({});
    goToStep(5);
  }

  // ─── Calculations for Step 5 Summary ───────────────────────────────────────
  const duration = trip.durationDays || 3;
  const hotelNightsCost = (trip.selectedHotel?.pricePerNight || 3000) * duration;
  const cabCost = trip.selectedCab?.fare || 0;
  const totalCost = hotelNightsCost + cabCost + ticketTotal;

  // Distribute places across days for Step 5
  const daySchedules = useMemo(() => {
    const days = [];
    for (let i = 1; i <= duration; i++) days.push([]);
    trip.selectedAttractions.forEach((a, idx) => {
      const dayIndex = idx % duration;
      days[dayIndex].push(a);
    });
    return days;
  }, [trip.selectedAttractions, duration]);

  return (
    <div className="trip-planner-progressive-shell">
      {/* Top Stepper Indicator */}
      <div className="planner-stepper-header">
        <div className="stepper-title-row">
          <span className="step-indicator-pill">Step {step} of 5</span>
          <button
            type="button"
            className="planner-sunshine-btn"
            onClick={onOpenSunshine}
            title="Ask Sunshine about what's on your screen!"
          >
            ☀️ Ask Sunshine
          </button>
        </div>

        <div className="stepper-breadcrumbs-row">
          <div className="progressive-step-breadcrumbs">
            {[
              { s: 1, label: "1. Places" },
              { s: 2, label: "2. Hotel" },
              { s: 3, label: "3. Transport" },
              { s: 4, label: "4. Tickets" },
              { s: 5, label: "5. Trip" },
            ].map((item) => (
              <button
                key={item.s}
                type="button"
                className={`breadcrumb-step ${step === item.s ? "active" : ""} ${
                  step > item.s ? "completed" : ""
                }`}
                onClick={() => {
                  // Only allow navigating backwards or to next available step
                  if (item.s <= step || (item.s === 2 && trip.selectedAttractions.length > 0)) {
                    goToStep(item.s);
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="planner-exit-btn"
            onClick={onExitPlanning}
            title="Exit trip planner to open map"
          >
            ✕ Exit Planner
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 1: MULTI-SELECT PLACES                                               */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="planner-step-body">
          <div className="step-heading-block">
            <h3>Select Places to Visit (Multi-Select)</h3>
            <p className="step-instruction">
              Choose the sights you want to explore in {cityName}. Select multiple options below, then proceed to choose your hotel!
            </p>
          </div>

          <div className="duration-setter-row">
            <label htmlFor="trip-days">Trip Duration:</label>
            <select
              id="trip-days"
              value={trip.durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="duration-select"
            >
              <option value={1}>1 Day</option>
              <option value={2}>2 Days</option>
              <option value={3}>3 Days (Recommended)</option>
              <option value={4}>4 Days</option>
              <option value={5}>5 Days</option>
              <option value={7}>7 Days (Full Week)</option>
            </select>
          </div>

          {/* Multi-Select Toolbar & Batch Controls */}
          <div className="multi-select-toolbar">
            <div className="selected-badge-count">
              <span>Selected:</span>
              <strong>{trip.selectedAttractions.length}</strong> of {attractions.length} sights
            </div>

            <div className="batch-action-buttons">
              <button
                type="button"
                className="batch-btn clear"
                onClick={handleClearAll}
                disabled={trip.selectedAttractions.length === 0}
                title="Deselect all sights"
              >
                ✕ Clear
              </button>
            </div>
          </div>

          {/* Selected Sights Pills Strip */}
          {trip.selectedAttractions.length > 0 && (
            <div className="selected-sights-summary-bar">
              <span className="summary-bar-label">In Itinerary ({trip.selectedAttractions.length}):</span>
              <div className="selected-chips-scroll">
                {trip.selectedAttractions.map((a) => {
                  const key = a._id || a.osmId || a.name;
                  return (
                    <span key={key} className="selected-sight-chip">
                      {a.name}
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAttraction(key);
                        }}
                        title={`Remove ${a.name}`}
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="category-filter-chips step1-categories">
            {SIGHT_CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`filter-chip ${placesCategoryFilter === cat.id ? "active" : ""}`}
                onClick={() => setPlacesCategoryFilter(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Multi-Select Sights Checklist */}
          <div className="sights-multi-select-list">
            {filteredStep1Attractions.length === 0 ? (
              <div className="empty-filter-state">
                <p>No sights found in this category.</p>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setPlacesCategoryFilter("all")}
                >
                  Show All Sights
                </button>
              </div>
            ) : (
              filteredStep1Attractions.map((a, idx) => {
                const key = a._id || a.osmId || a.name;
                const isSelected = selectedKeys.has(key);
                const isFree =
                  a.category === "Place of Worship" ||
                  a.category === "Beach" ||
                  a.category === "Park & Nature" ||
                  a.category === "Nature & Scenic Spot";
                const priceLabel = isFree ? "Free Entry" : `₹${50 + (idx % 4) * 50}`;
                const rating = a.rating || (4.3 + (idx % 6) * 0.1).toFixed(1);

                return (
                  <div
                    key={key}
                    className={`sight-select-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleToggleAttraction(a)}
                  >
                    <div className="sight-checkbox-col">
                      <input
                        type="checkbox"
                        className="sight-checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Click handled by wrapper div
                        aria-label={`Select ${a.name}`}
                      />
                    </div>

                    <div className="sight-details-col">
                      <div className="sight-title-row">
                        <span className="sight-name">
                          <span className="sight-card-icon" style={{ marginRight: "6px" }}>{a.icon || "🏛️"}</span>
                          {a.name}
                        </span>
                        {a.isAiRecommended && (
                          <span className="ai-pick-badge">✨ AI Recommended</span>
                        )}
                        <span className="badge category-badge">{a.category}</span>
                      </div>

                      <div className="sight-meta-row">
                        <span className="rating-pill">⭐ {rating}</span>
                        <span className={`entry-price-pill ${isFree ? "price-free" : "price-paid"}`}>
                          {priceLabel}
                        </span>
                        {a.description && (
                          <span className="sight-snippet">
                            {a.description.length > 90 ? a.description.slice(0, 90) + "…" : a.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="sight-action-col">
                      <a
                        className="know-more-btn sight-know-more-btn secondary small"
                        href={`https://www.google.com/search?q=${encodeURIComponent(`${a.name} ${cityName} tourist attraction reviews photos`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Search photos & reviews on Google"
                        style={{ textDecoration: "none", fontSize: "0.78rem", padding: "4px 8px" }}
                      >
                        🔍 Know more
                      </a>
                      {onFocusMap && (
                        <button
                          type="button"
                          className="secondary small map-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onFocusMap(a);
                          }}
                          title="Focus on Map"
                        >
                          📍 Map
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="step-actions-footer">
            <div className="footer-status-text">
              {trip.selectedAttractions.length === 0 ? (
                <span className="status-warning-text">⚠️ Check options above to add sights to your trip</span>
              ) : (
                <span className="status-ready-text">
                  ✓ <strong>{trip.selectedAttractions.length}</strong> {trip.selectedAttractions.length === 1 ? "sight" : "sights"} selected
                </span>
              )}
            </div>

            <button
              type="button"
              className="primary continue-btn"
              disabled={trip.selectedAttractions.length === 0}
              onClick={() => goToStep(2)}
            >
              Proceed with {trip.selectedAttractions.length} {trip.selectedAttractions.length === 1 ? "Sight" : "Sights"} ➔ Choose Hotel
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 2: HOTEL SELECTION                                                    */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="planner-step-body">
          <div className="step-heading-block">
            <h3>Choose Where to Stay</h3>
            <p className="step-instruction">
              Optimized for your {trip.selectedAttractions.length} sights to minimize travel time.
            </p>
          </div>

          {/* ── 1. Selected Sights Summary (Stop showing other tourist spots, show only selected) ── */}
          <div className="step2-selected-spots-box">
            <div className="step2-selected-header">
              <div className="step2-selected-title">
                <span className="step2-section-icon">🏛️</span>
                <div>
                  <strong>Your Selected Sights ({trip.selectedAttractions.length})</strong>
                  <span className="step2-selected-subtitle">
                    {activeShowAddMorePlaces
                      ? "Showing other available sights below to add"
                      : "Only your selected tourist spots are shown"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="step2-add-places-toggle-btn"
                onClick={() => setActiveShowAddMorePlaces(!activeShowAddMorePlaces)}
              >
                {activeShowAddMorePlaces ? "✓ Done Adding" : "➕ Add More Places"}
              </button>
            </div>

            {/* Display ONLY selected tourist spots */}
            <div className="step2-selected-chips-grid">
              {trip.selectedAttractions.map((a) => {
                const key = a._id || a.osmId || a.name;
                return (
                  <div key={key} className="step2-selected-chip">
                    <span className="chip-name">{a.name}</span>
                    <span className="chip-cat">{a.category || "Sight"}</span>
                    {onFocusMap && (
                      <button
                        type="button"
                        className="chip-focus-map-btn"
                        onClick={() => onFocusMap(a)}
                        title="Locate on map"
                      >
                        📍
                      </button>
                    )}
                    <button
                      type="button"
                      className="chip-remove-sight-btn"
                      onClick={() => removeAttraction(key)}
                      title="Remove sight"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {/* When user wants to add more, show other places */}
            {activeShowAddMorePlaces && (
              <div className="step2-add-more-places-drawer">
                <div className="drawer-header">
                  <h5>Add More Sights in {cityName}:</h5>
                  <span className="drawer-count">{remainingAttractions.length} more available</span>
                </div>
                {remainingAttractions.length === 0 ? (
                  <p className="no-remaining-text">All available sights in {cityName} have been added!</p>
                ) : (
                  <div className="step2-remaining-places-list">
                    {remainingAttractions.map((a) => {
                      const key = a._id || a.osmId || a.name;
                      return (
                        <div key={key} className="remaining-place-row">
                          <div className="remaining-place-info">
                            <strong>{a.name}</strong>
                            <span className="remaining-place-cat">{a.category}</span>
                            {a.rating && <span className="remaining-place-rating">⭐ {a.rating}</span>}
                          </div>
                          <div className="remaining-place-actions">
                            {onFocusMap && (
                              <button
                                type="button"
                                className="secondary small map-btn"
                                onClick={() => onFocusMap(a)}
                                title="Locate on map"
                              >
                                📍 Map
                              </button>
                            )}
                            <button
                              type="button"
                              className="add-sight-btn"
                              onClick={() => addAttraction(a)}
                            >
                              + Add to Trip
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 2. Hotel Selection (Once selected, stop showing other hotels) ── */}
          <div className="step2-hotels-section">
            {trip.selectedHotel && !activeIsChangingHotel ? (
              /* Once selected, ONLY show the selected hotel */
              <div className="single-selected-hotel-wrapper">
                <div className="selected-hotel-banner">
                  <div className="selected-hotel-banner-title">
                    <span className="hotel-banner-icon">{trip.selectedHotel.icon || "🏨"}</span>
                    <div>
                      <strong>Your Selected Stay</strong>
                      <span className="hotel-banner-sub">Other hotels are hidden</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="change-hotel-btn"
                    onClick={() => setActiveIsChangingHotel(true)}
                  >
                    🔄 Change Hotel
                  </button>
                </div>

                <div className="planner-hotel-card selected-only">
                  <div className="hotel-info-col">
                    <div className="hotel-title-row">
                      <h5>
                        <span className="hotel-card-icon" style={{ marginRight: "6px" }}>{trip.selectedHotel.icon || "🏨"}</span>
                        {trip.selectedHotel.name}
                      </h5>
                      {trip.selectedHotel.badge && (
                        <span className={`rank-badge ${trip.selectedHotel.badge.type}`}>
                          {trip.selectedHotel.badge.label}
                        </span>
                      )}
                    </div>

                    <div className="hotel-meta-row">
                      <span className="hotel-rate">
                        ₹{trip.selectedHotel.pricePerNight?.toLocaleString("en-IN")} / night
                      </span>
                      <span className="hotel-rating">⭐ {trip.selectedHotel.rating}</span>
                      {trip.selectedHotel.address && (
                        <span className="hotel-address-text">📍 {trip.selectedHotel.address}</span>
                      )}
                    </div>

                    <div className="hotel-dist-row">
                      <span>Avg to sights: <strong>{trip.selectedHotel.avgDistToAttractions || 2.4} km</strong></span>
                      <span>·</span>
                      <span>Arrival terminal: <strong>{trip.selectedHotel.distToArrival || 3.1} km</strong></span>
                    </div>
                  </div>

                  <div className="hotel-action-col">
                    <div className="mini-location-score">
                      <strong>{trip.selectedHotel.locationScore || 88}</strong>
                      <span>Location</span>
                    </div>
                    <a
                      className="know-more-btn hotel-know-more-btn secondary small"
                      href={`https://www.google.com/search?q=${encodeURIComponent(`${trip.selectedHotel.name} ${cityName} hotel reviews photos`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Search photos & reviews on Google"
                      style={{ textDecoration: "none", fontSize: "0.78rem", padding: "4px 8px", marginTop: "4px" }}
                    >
                      🔍 Know more
                    </a>
                    <span className="hotel-confirmed-pill">Selected Stay ✓</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Show all hotels when no hotel selected or user clicked "Change Hotel" */
              <>
                <div className="hotels-list-top-bar">
                  <div className="hotel-filters-toolbar">
                    <div className="hotel-filter-pills">
                      <span className="filter-label">Max Price:</span>
                      {HOTEL_PRICE_FILTERS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          className={`filter-chip ${hotelFilter === f.id ? "active" : ""}`}
                          onClick={() => setHotelFilter(f.id)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="hotel-sort-wrap">
                      <span className="filter-label">Sort:</span>
                      <select
                        className="hotel-sort-select"
                        value={hotelSort}
                        onChange={(e) => setHotelSort(e.target.value)}
                      >
                        <option value="score">📍 Best Location</option>
                        <option value="price-asc">💰 Price: Low to High</option>
                        <option value="price-desc">💎 Price: High to Low</option>
                        <option value="rating">⭐ Top Rated</option>
                      </select>
                    </div>
                  </div>
                  {activeIsChangingHotel && trip.selectedHotel && (
                    <button
                      type="button"
                      className="cancel-change-hotel-btn"
                      onClick={() => setActiveIsChangingHotel(false)}
                    >
                      Keep Current Hotel
                    </button>
                  )}
                </div>

                <div className="planner-hotels-list">
                  {filteredHotels.map((h) => {
                    const hotelKey = h._id || h.osmId || h.name;
                    const isSelected =
                      (trip.selectedHotel?._id || trip.selectedHotel?.osmId || trip.selectedHotel?.name) === hotelKey;

                    return (
                      <div
                        key={hotelKey}
                        className={`planner-hotel-card ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          handleHotelSelection(h);
                          setActiveIsChangingHotel(false);
                        }}
                      >
                        <div className="hotel-info-col">
                          <div className="hotel-title-row">
                            <h5>
                              <span className="hotel-card-icon" style={{ marginRight: "6px" }}>{h.icon || "🏨"}</span>
                              {h.name}
                            </h5>
                            {h.badge && <span className={`rank-badge ${h.badge.type}`}>{h.badge.label}</span>}
                          </div>

                          <div className="hotel-meta-row">
                            <span className="hotel-rate">₹{h.pricePerNight?.toLocaleString("en-IN")} / night</span>
                            <span className="hotel-rating">⭐ {h.rating}</span>
                          </div>

                          <div className="hotel-dist-row">
                            <span>Avg to sights: <strong>{h.avgDistToAttractions} km</strong></span>
                            <span>·</span>
                            <span>Arrival: <strong>{h.distToArrival} km</strong></span>
                          </div>
                        </div>

                        <div className="hotel-action-col">
                          <div className="mini-location-score">
                            <strong>{h.locationScore}</strong>
                            <span>Location</span>
                          </div>
                          <a
                            className="know-more-btn hotel-know-more-btn secondary small"
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${h.name} ${cityName} hotel reviews photos`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Search photos & reviews on Google"
                            style={{ textDecoration: "none", fontSize: "0.78rem", padding: "4px 8px" }}
                          >
                            🔍 Know more
                          </a>
                          <button
                            type="button"
                            className={`select-btn ${isSelected ? "selected" : ""}`}
                          >
                            {isSelected ? "Selected ✓" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="step-actions-footer">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setActiveShowAddMorePlaces(false);
                setActiveIsChangingHotel(false);
                goToStep(1);
              }}
            >
              ← Back to Places
            </button>
            <button
              type="button"
              className="primary continue-btn"
              disabled={!trip.selectedHotel}
              onClick={() => {
                if (!trip.arrivalHub) selectArrivalHub(activeArrivalHub);
                setActiveShowAddMorePlaces(false);
                setActiveIsChangingHotel(false);
                goToStep(3);
              }}
            >
              Continue ➔ Transport
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 3: TRANSPORT & CAB                                                    */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="planner-step-body">
          <div className="step-heading-block">
            <h3>Airport / Station to Hotel Transfer</h3>
            <p className="step-instruction">
              Direct road route from your arrival terminal to your hotel.
            </p>
          </div>

          {/* Arrival Mode Selection in Step 3 */}
          <div className="planner-arrival-mode-select">
            <span className="section-mini-title">Select Arrival Mode:</span>
            <div className="planner-arrival-modes-grid">
              {[
                { id: "train", label: "By Train", icon: "🚆", hubType: "Railway Station" },
                { id: "flight", label: "By Flight", icon: "✈️", hubType: "Airport" },
                { id: "bus", label: "By Bus", icon: "🚌", hubType: "Bus Station" },
                { id: "car", label: "Self Drive", icon: "🚗", hubType: "Other" },
              ].map((mode) => {
                const currentHub = trip.arrivalHub || activeArrivalHub;
                const isSelected = currentHub?.type === mode.hubType || (!currentHub && mode.id === "train");

                return (
                  <button
                    key={mode.id}
                    type="button"
                    className={`arrival-mode-pill-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      let hub;
                      if (mode.id === "car") {
                        hub = {
                          name: `${destination?.displayName?.split(",")[0] || "City"} Entry Point`,
                          type: "Other",
                          lat: destination?.lat,
                          lon: destination?.lon,
                        };
                      } else {
                        hub = transportHubs.find((h) => h.type === mode.hubType);
                        if (!hub && mode.id === "bus") hub = transportHubs.find((h) => h.type === "Bus Stop");
                        if (!hub) {
                          hub = {
                            name: `${destination?.displayName?.split(",")[0] || "City"} ${mode.label} Terminal`,
                            type: mode.hubType,
                            lat: (destination?.lat || 0) + 0.012,
                            lon: (destination?.lon || 0) + 0.012,
                          };
                        }
                      }
                      selectArrivalHub(hub);
                    }}
                  >
                    <span className="mode-pill-icon">{mode.icon}</span>
                    <span className="mode-pill-label">{mode.label}</span>
                    {isSelected && <span className="mode-pill-badge">Selected ✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual Route Diagram */}
          <div className="visual-route-card">
            <div className="route-node">
              <span className="node-icon">📍</span>
              <div>
                <span className="node-label">Arrival Terminal</span>
                <strong>{trip.arrivalHub?.name || activeArrivalHub?.name}</strong>
              </div>
            </div>

            <div className="route-connector">
              <span className="down-arrow">↓</span>
              <span className="connector-distance">{transitDistanceKm} km via road</span>
              <span className="down-arrow">↓</span>
            </div>

            <div className="route-node">
              <span className="node-icon">🏨</span>
              <div>
                <span className="node-label">Selected Hotel</span>
                <strong>{trip.selectedHotel?.name}</strong>
              </div>
            </div>
          </div>

          {/* Cab Selection Grid */}
          <div className="cab-selection-section">
            <h4>Choose a local travel package:</h4>
            <div className="cabs-grid">
              {LOCAL_TRANSPORT_PACKAGES.map((cab) => {
                const fare = calculateFare(cab);
                const isChosen = chosenCabId === cab.id;

                return (
                  <button
                    key={cab.id}
                    type="button"
                    className={`cab-card-btn ${isChosen ? "chosen selected" : ""}`}
                    onClick={() => {
                      setChosenCabId(cab.id);
                      saveCabChoice(cab.id);
                    }}
                  >
                    <span className="cab-icon">{cab.icon}</span>
                    <span className="cab-name">{cab.name}</span>
                    <span className="cab-fare">{cab.rateText || (fare === 0 ? "Free" : `₹${fare}`)}</span>
                    <span className="cab-rate-detail">{cab.detail}</span>
                    <span className={`cab-selected-pill ${isChosen ? "selected" : ""}`}>
                      {isChosen ? "Selected ✓" : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="step-actions-footer">
            <button type="button" className="secondary" onClick={() => goToStep(2)}>
              ← Back to Hotel
            </button>
            <button
              type="button"
              className="primary continue-btn"
              onClick={() => {
                saveCabChoice(chosenCabId);
                goToStep(4);
              }}
            >
              Continue ➔ Tickets
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 4: ATTRACTION TICKETS                                                 */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="planner-step-body">
          <div className="step-heading-block">
            <h3>Attraction Passes & Entry Tickets</h3>
            <p className="step-instruction">
              Choose the entry passes you'll need for your {trip.selectedAttractions.length} selected sights. Nothing is booked yet — booking happens at the final step.
            </p>
          </div>

          <div className="tickets-checklist">
            {trip.selectedAttractions.map((a) => {
              const key = a._id || a.osmId || a.name;
              const item = ticketsState[key] || { selected: true, visitors: 2, price: 0 };
              const isFree = item.price === 0;

              return (
                <div key={key} className={`ticket-row-item ${item.selected ? "selected" : ""}`}>
                  <div className="ticket-item-left">
                    <input
                      type="checkbox"
                      id={`ticket-chk-${key}`}
                      checked={item.selected}
                      onChange={() => handleTicketToggle(key)}
                    />
                    <label htmlFor={`ticket-chk-${key}`}>
                      <strong>{a.name}</strong>
                      <span className="badge category-badge">{a.category}</span>
                    </label>
                  </div>

                  <div className="ticket-item-right">
                    <span className={`entry-badge ${isFree ? "free" : "paid"}`}>
                      {isFree ? "FREE" : `₹${item.price}/person`}
                    </span>

                    {item.selected && !isFree && (
                      <div className="visitor-counter">
                        <button
                          type="button"
                          onClick={() => handleTicketVisitorChange(key, -1)}
                          disabled={item.visitors <= 1}
                        >
                          -
                        </button>
                        <span>{item.visitors} visitors</span>
                        <button
                          type="button"
                          onClick={() => handleTicketVisitorChange(key, 1)}
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

          <div className="tickets-total-bar">
            <span>Ticket Total:</span>
            <strong>₹{ticketTotal}</strong>
          </div>

          <div className="step-actions-footer">
            <button type="button" className="secondary" onClick={() => goToStep(3)}>
              ← Back to Transport
            </button>
            <button type="button" className="secondary" onClick={handleSkipTickets}>
              Skip
            </button>
            <button
              type="button"
              className="primary continue-btn"
              onClick={handleConfirmTickets}
            >
              Continue ➔ Summary
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* STEP 5: FINAL TRIP SUMMARY RECAP                                           */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="planner-step-body final-summary-body">
          <div className="summary-banner-card">
            <span className="summary-party-icon">🎉</span>
            <h3>YOUR {cityName.toUpperCase()} TRIP Budget Estimate</h3>
            <p className="summary-duration-tag">{duration} Days Itinerary</p>
          </div>

          <div className="recap-sections-list">
            {/* Arrival */}
            <div className="recap-section-row">
              <span className="recap-icon">🚆</span>
              <div className="recap-content">
                <span className="recap-label">ARRIVAL</span>
                <strong>{trip.arrivalHub?.name || activeArrivalHub?.name}</strong>
              </div>
            </div>

            {/* Hotel */}
            <div className="recap-section-row">
              <span className="recap-icon">🏨</span>
              <div className="recap-content">
                <span className="recap-label">HOTEL</span>
                <strong>{trip.selectedHotel?.name}</strong>
                <span className="recap-subtext">
                  ₹{trip.selectedHotel?.pricePerNight?.toLocaleString("en-IN")} / night × {duration} nights
                </span>
              </div>
            </div>

            {/* Transport */}
            <div className="recap-section-row">
              <span className="recap-icon">🚕</span>
              <div className="recap-content">
                <span className="recap-label">TRANSPORT</span>
                <strong>{trip.selectedCab?.name || "Sedan Cab"}</strong>
                <span className="recap-subtext">₹{cabCost} (Transfer to hotel)</span>
              </div>
            </div>

            {/* Day by Day Places */}
            <div className="recap-section-row places-recap">
              <span className="recap-icon">📍</span>
              <div className="recap-content">
                <span className="recap-label">PLACES SCHEDULE</span>
                <div className="day-by-day-recap">
                  {daySchedules.map((sights, idx) => (
                    <div key={idx} className="recap-day-group">
                      <strong>Day {idx + 1}</strong>
                      <ul>
                        {sights.map((s) => (
                          <li key={s._id || s.osmId || s.name}>{s.name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tickets */}
            <div className="recap-section-row">
              <span className="recap-icon">🎟️</span>
              <div className="recap-content">
                <span className="recap-label">TICKETS</span>
                <strong>₹{ticketTotal}</strong>
              </div>
            </div>

            {/* Estimated Total */}
            <div className="recap-total-box">
              <span className="total-title">Estimated Total</span>
              <span className="total-amount">₹{totalCost.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="summary-actions-grid summary-actions-3col">
            <button
              type="button"
              className="secondary explore-more-btn"
              onClick={onExitPlanning}
            >
              ← Explore More
            </button>

            <button
              type="button"
              className="primary view-full-trip-btn"
              onClick={onToggleFullTripMap}
              disabled={!trip.selectedHotel || trip.selectedAttractions.length === 0}
            >
              {isFullTripMapOpen ? "🗺️ Hide Full Trip Map" : "🗺️ View Full Trip on Map"}
            </button>

            <button
              type="button"
              className="primary book-now-btn"
              onClick={onOpenBooking}
            >
              🎫 Book Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
