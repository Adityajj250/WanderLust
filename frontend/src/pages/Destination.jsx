import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import MapView from "../components/MapView.jsx";
import DestinationOverview from "../components/DestinationOverview.jsx";
import AttractionsList from "../components/AttractionsList.jsx";
import HotelsList from "../components/HotelsList.jsx";
import TransportView from "../components/TransportView.jsx";
import TripPlannerFlow from "../components/TripPlannerFlow.jsx";
import BookingFlow from "../components/BookingFlow.jsx";
import WeatherBanner from "../components/WeatherBanner.jsx";
import SunshineWorkspaceModal from "../components/SunshineWorkspaceModal.jsx";
import { useTrip } from "../context/TripContext.jsx";
import {
  geocodeDestination,
  fetchAttractions,
  fetchHotels,
  fetchTransportHubs,
  fetchDistances,
} from "../api/api.js";

export default function Destination() {
  const { query } = useParams();
  const [searchParams] = useSearchParams();

  const {
    trip,
    initDestination,
    selectHotel,
    selectArrivalHub,
    setIsPlanning,
    setCurrentPlanStep,
    openAiModal,
  } = useTrip();

  const [status, setStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState("");

  const [destination, setDestination] = useState(null);
  const [attractions, setAttractions] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [transportHubs, setTransportHubs] = useState([]);
  const [isSunshineOpen, setIsSunshineOpen] = useState(false);
  const [screenWeather, setScreenWeather] = useState(null);

  // Top-Level Workspace Tabs: 'overview' | 'attractions' | 'hotels' | 'transport'
  const [activeTab, setActiveTab] = useState("overview");

  // Users can independently show or hide each map layer.
  const [mapLayers, setMapLayers] = useState(["attractions", "hotels", "transport"]);

  // Inspected items on map
  const [inspectedHotel, setInspectedHotel] = useState(null);
  const [inspectedAttraction, setInspectedAttraction] = useState(null);
  const [hotelDistances, setHotelDistances] = useState([]);
  const [hubToHotelDistances, setHubToHotelDistances] = useState([]);
  // Transport hub clicked on map → triggers hub→hotels road lines
  const [selectedTransportHub, setSelectedTransportHub] = useState(null);

  // State for adding more places and changing hotel during planning
  const [showAddMorePlaces, setShowAddMorePlaces] = useState(false);
  const [isChangingHotel, setIsChangingHotel] = useState(false);

  // Full trip map view (selected hotel + selected sights, all linked)
  const [showFullTripMap, setShowFullTripMap] = useState(false);

  // Full-screen booking mode
  const [isBooking, setIsBooking] = useState(false);
  const [bookingState, setBookingState] = useState(() => {
    try {
      const saved = sessionStorage.getItem("wanderlust_booking_state");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {};
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("wanderlust_booking_state", JSON.stringify(bookingState));
    } catch (_) {}
  }, [bookingState]);

  // Load destination + POIs
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Immediately reset previous destination's places
    setAttractions([]);
    setHotels([]);
    setTransportHubs([]);

    async function load() {
      setStatus("loading");
      setErrorMessage("");

      try {
        const dest = await geocodeDestination(query);
        if (cancelled) return;
        setDestination(dest);

        const [attractionsData, hotelsData, transportData] = await Promise.all([
          fetchAttractions(
            query,
            dest.lat,
            dest.lon,
            {
              days: trip.durationDays,
              travellers: trip.travellers,
            },
            controller.signal
          ),
          fetchHotels(query, dest.lat, dest.lon),
          fetchTransportHubs(query, dest.lat, dest.lon).catch(() => []),
        ]);

        if (cancelled) return;

        const sortedAttractions = (attractionsData || []).slice().sort(
          (a, b) => (b.score || 0) - (a.score || 0)
        );

        // Check if user came from AI Trip Planner shortcut
        const aiPlacesJson = sessionStorage.getItem("ai_preselect_places");
        const shouldPlan = searchParams.get("mode") === "plan";
        let initialSelected = [];
        let aiRecommendedNames = [];

        if (aiPlacesJson) {
          try {
            const places = JSON.parse(aiPlacesJson);
            if (Array.isArray(places) && places.length > 0) {
              aiRecommendedNames = places;
              const matched = [];
              const matchedKeys = new Set();

              places.forEach((pName) => {
                const clean = pName.toLowerCase().replace(/[^a-z0-9]/g, "");
                const tokens = pName
                  .toLowerCase()
                  .split(/[\s,.-]+/)
                  .filter((t) => t.length >= 4);

                const match = sortedAttractions.find((a) => {
                  const aClean = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                  if (aClean.includes(clean) || clean.includes(aClean)) return true;
                  return tokens.some((tok) => aClean.includes(tok));
                });

                if (match) {
                  const key = match._id || match.osmId || match.name;
                  if (!matchedKeys.has(key)) {
                    matchedKeys.add(key);
                    matched.push({ ...match, isAiRecommended: true });
                  }
                }
              });

              // Pre-select multiple sights (if matching found, or default top 4-5)
              if (matched.length > 0) {
                initialSelected = matched;
              } else {
                initialSelected = sortedAttractions.slice(0, 4).map((a) => ({ ...a, isAiRecommended: true }));
              }
            }
          } catch (_) {}
          sessionStorage.removeItem("ai_preselect_places");
        }

        // Tag all matching attractions in the main list with isAiRecommended
        const enrichedAttractions = sortedAttractions.map((a) => {
          const aClean = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          const isRec =
            a.isAiRecommended ||
            aiRecommendedNames.some((pName) => {
              const clean = pName.toLowerCase().replace(/[^a-z0-9]/g, "");
              const tokens = pName
                .toLowerCase()
                .split(/[\s,.-]+/)
                .filter((t) => t.length >= 4);
              return aClean.includes(clean) || clean.includes(aClean) || tokens.some((tok) => aClean.includes(tok));
            });
          return isRec ? { ...a, isAiRecommended: true } : a;
        });

        setAttractions(enrichedAttractions);
        setHotels(hotelsData || []);
        setTransportHubs(transportData || []);

        initDestination(dest, initialSelected, shouldPlan);
        if (shouldPlan) {
          setCurrentPlanStep(1);
        }

        setStatus("ready");
      } catch (err) {
        if (cancelled || err.name === "CanceledError" || err.name === "AbortError" || err.code === "ERR_CANCELED") return;
        console.error(err);
        setErrorMessage(
          err.response?.data?.error || "Couldn't locate that destination. Please try another search."
        );
        setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle hotel selection/toggle — also used by Map button in HotelsList
  const handleSelectHotel = useCallback(
    async (hotel) => {
      if (!hotel) {
        // explicit clear (called with null)
        selectHotel(null);
        setInspectedHotel(null);
        setHotelDistances([]);
        return;
      }
      const hotelKey = hotel._id || hotel.osmId || hotel.name;
      const selectedKey = trip.selectedHotel?._id || trip.selectedHotel?.osmId || trip.selectedHotel?.name;
      // Toggle: clicking the same hotel again → neutral state
      if (hotelKey === selectedKey) {
        selectHotel(null);
        setInspectedHotel(null);
        setHotelDistances([]);
        return;
      }
      setInspectedHotel(hotel);
      selectHotel(hotel);
      // Switch right panel to Hotels tab so the card is visible
      if (!trip.isPlanning) setActiveTab("hotels");
      try {
        const d = await fetchDistances(hotel, attractions);
        setHotelDistances(d || []);
      } catch (err) {
        console.error(err);
      }
    },
    [attractions, selectHotel, trip.selectedHotel, trip.isPlanning]
  );

  // Map button in HotelsList: highlights hotel on map and switches to hotels tab
  const handleFocusHotelOnMap = useCallback((hotel) => {
    handleSelectHotel(hotel);
    if (!trip.isPlanning) setActiveTab("hotels");
  }, [handleSelectHotel, trip.isPlanning]);

  const handleSelectAttraction = useCallback((attraction) => {
    setInspectedAttraction(attraction);
    if (!trip.isPlanning) setActiveTab("attractions");
  }, [trip.isPlanning]);

  const toggleMapLayer = useCallback((layer) => {
    setMapLayers((layers) => layers.includes(layer) ? layers.filter((item) => item !== layer) : [...layers, layer]);
  }, []);

  const handleSelectHub = useCallback(
    async (hub) => {
      selectArrivalHub(hub);
      // Toggle: clicking the same hub again clears the hub→hotels lines
      const prevKey = selectedTransportHub?._id || selectedTransportHub?.osmId || selectedTransportHub?.name;
      const hubKey  = hub?._id || hub?.osmId || hub?.name;
      const isToggleOff = prevKey === hubKey;
      setSelectedTransportHub(isToggleOff ? null : hub);
      if (!isToggleOff) {
        try {
          const d = await fetchDistances(hub, hotels);
          setHubToHotelDistances(d || []);
        } catch (_) {
          setHubToHotelDistances([]);
        }
      } else {
        setHubToHotelDistances([]);
      }
    },
    [selectArrivalHub, selectedTransportHub, hotels]
  );

  // Resets all map selections back to neutral
  const handleClearMap = useCallback(() => {
    selectHotel(null);
    setInspectedHotel(null);
    setInspectedAttraction(null);
    setHotelDistances([]);
    setSelectedTransportHub(null);
    setHubToHotelDistances([]);
    selectArrivalHub(null);
  }, [selectHotel, selectArrivalHub]);

  // Determine active route for the map (e.g. between arrival terminal and selected hotel)
  const activeRoute = useMemo(() => {
    const hotel = inspectedHotel || trip.selectedHotel;
    if (trip.arrivalHub && hotel) {
      return {
        from: [trip.arrivalHub.lat, trip.arrivalHub.lon],
        to: [hotel.lat, hotel.lon],
        label: <><strong>{trip.arrivalHub.name}</strong> ➔ <strong>{hotel.name}</strong></>,
        distText: hotel.distToArrival ? `${hotel.distToArrival} km` : "",
      };
    }
    return null;
  }, [trip.arrivalHub, inspectedHotel, trip.selectedHotel]);

  // Determine transit route (e.g. railway station route when transit layer is active)
  const transitRoute = useMemo(() => {
    if (!mapLayers.includes("transport") && !trip.arrivalHub) return null;
    const railway = trip.arrivalHub || transportHubs.find((h) => h.type === "Railway Station") || transportHubs.find((h) => h.type === "Bus Station");
    if (!railway) return null;
    const target = inspectedHotel || trip.selectedHotel || destination;
    if (!target) return null;
    // Don't duplicate if already rendered by activeRoute
    if (trip.arrivalHub && (inspectedHotel || trip.selectedHotel)) return null;

    return {
      from: [railway.lat, railway.lon],
      to: [target.lat, target.lon],
      label: <><strong>{railway.name}</strong> ➔ <strong>{target.name || target.displayName?.split(",")[0] || "City Center"}</strong></>,
      distText: target.distToArrival ? `${target.distToArrival} km` : "",
    };
  }, [mapLayers, trip.arrivalHub, transportHubs, inspectedHotel, trip.selectedHotel, destination]);

  const selectedCount = trip.selectedAttractions.length;

  // Map Attractions:
  // Once the user has selected tourist spots and proceeds to hotels (step >= 2),
  // stop showing other tourist spots and just show him spots he selected!
  // When he goes back to step 1 (or clicks Add More), show all places.
  const mapAttractions = useMemo(() => {
    if (trip.isPlanning && trip.currentPlanStep >= 2 && trip.selectedAttractions.length > 0 && !showAddMorePlaces) {
      return trip.selectedAttractions;
    }
    return attractions;
  }, [trip.isPlanning, trip.currentPlanStep, trip.selectedAttractions, attractions, showAddMorePlaces]);

  // Map Hotels:
  // In Step 1 (or when user goes back to places), all hotels MUST vanish from map!
  // In Step >= 2 (or when not planning):
  // - If a hotel is selected and not changing: only show the selected hotel! All other hotels vanish!
  // - If no hotel is selected (or user clicked it again to unselect, or is changing): show all hotels!
  const mapHotels = useMemo(() => {
    if (trip.isPlanning && trip.currentPlanStep === 1) {
      return [];
    }
    const currentHotel = inspectedHotel || trip.selectedHotel;
    if (currentHotel && !isChangingHotel) {
      return [currentHotel];
    }
    return hotels;
  }, [trip.isPlanning, trip.currentPlanStep, inspectedHotel, trip.selectedHotel, isChangingHotel, hotels]);

  // Leave full-trip view whenever the user moves away from the trip summary
  useEffect(() => {
    if (!trip.isPlanning || trip.currentPlanStep !== 5) setShowFullTripMap(false);
  }, [trip.isPlanning, trip.currentPlanStep]);

  const fullTripData = useMemo(() => {
    if (!showFullTripMap) return null;
    return { hotel: trip.selectedHotel, attractions: trip.selectedAttractions };
  }, [showFullTripMap, trip.selectedHotel, trip.selectedAttractions]);

  if (status === "loading") {
    return (
      <div className="status-loading-shell">
        <div className="status-spinner" />
        <p className="status-message">
          Finding the best places in <strong>"{query}"</strong>…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="status-message error">
        <p>{errorMessage}</p>
        <Link to="/" className="primary">← Back to search</Link>
      </div>
    );
  }

  return (
    <section className="destination-page-shell">
      {/* ── Destination Header Bar ────────────────────────────────────────── */}
      <div className="destination-top-bar">
        <div className="dest-title-group">
          <h2>{destination.displayName?.split(",")[0]}</h2>
          <span className="dest-region-subtitle">
            {destination.displayName?.split(",").slice(1, 3).join(", ")}
          </span>
        </div>

        <div className="dest-actions-group">
          <button
            type="button"
            className={`build-trip-cta ${trip.isPlanning ? "active" : ""}`}
            onClick={() => setIsPlanning(!trip.isPlanning)}
          >
            {trip.isPlanning ? "✕ Exit Planner" : `✨ Build My Trip ${selectedCount > 0 ? `(${selectedCount})` : ""}`}
          </button>
          <Link to="/" className="back-search-link">
            ← Search
          </Link>
        </div>
      </div>

      {/* ── Destination Weather Report Banner (Open-Meteo) ────────────────── */}
      <WeatherBanner destination={destination} onWeatherChange={setScreenWeather} />

      {/* ── Main Workspace: Full-Screen Booking Flow OR Two-Column Persistent Layout ── */}
      {isBooking ? (
        <div className="booking-flow-workspace-wrapper">
          <BookingFlow
            trip={trip}
            destination={destination}
            cityName={destination.displayName?.split(",")[0]?.trim() || query}
            transportHubs={transportHubs}
            onBack={() => setIsBooking(false)}
            bookingState={bookingState}
            setBookingState={setBookingState}
          />
        </div>
      ) : (
        <div className="workspace-columns-layout">
        {/* Left Column: Persistent Interactive Map */}
        <div className="workspace-map-col">
          {/* Map Layer Controls */}
          <div className="map-layer-filter-bar">
            <span className="filter-title">Layers:</span>
            <div className="layer-pill-buttons">
              <button
                type="button"
                className={`layer-pill ${mapLayers.includes("attractions") ? "active" : ""}`}
                onClick={() => toggleMapLayer("attractions")}
              >
                🏛️ Sights
              </button>
              <button
                type="button"
                className={`layer-pill ${mapLayers.includes("hotels") ? "active" : ""}`}
                onClick={() => toggleMapLayer("hotels")}
              >
                🏨 Hotels
              </button>
              <button
                type="button"
                className={`layer-pill ${mapLayers.includes("transport") ? "active" : ""}`}
                onClick={() => toggleMapLayer("transport")}
              >
                🚆 Transit
              </button>
            </div>
          </div>

          {showFullTripMap && (
            <div className="full-trip-map-banner">
              <div className="full-trip-legend">
                <strong>🗺️ Full Trip View</strong>
                <span><i className="legend-line hotel-line" /> Hotel → every sight</span>
                <span><i className="legend-line sight-line" /> Sight → 2 nearest sights</span>
              </div>
              <button type="button" className="full-trip-close-btn" onClick={() => setShowFullTripMap(false)}>
                ✕ Close
              </button>
            </div>
          )}

          <MapView
            fullTrip={fullTripData}
            center={destination}
            attractions={mapAttractions}
            hotels={mapHotels}
            allHotels={hotels}
            allAttractions={attractions}
            selectedAttractionsList={trip.selectedAttractions}
            transportHubs={transportHubs}
            activeLayer={mapLayers}
            selectedHotel={inspectedHotel || trip.selectedHotel}
            selectedAttraction={inspectedAttraction}
            selectedTransportHub={selectedTransportHub}
            arrivalPoint={trip.arrivalHub}
            activeRoute={activeRoute}
            transitRoute={transitRoute}
            hotelDistances={hotelDistances}
            hubToHotelDistances={hubToHotelDistances}
            onSelectHotel={handleSelectHotel}
            onSelectAttraction={handleSelectAttraction}
            onSelectTransportHub={handleSelectHub}
            onClearMap={handleClearMap}
          />
        </div>

        {/* Right Column: Contextual Tabs OR Progressive 5-Step Trip Planner */}
        <div className="workspace-content-col">
          {trip.isPlanning ? (
            <TripPlannerFlow
              destination={destination}
              attractions={attractions}
              hotels={hotels}
              transportHubs={transportHubs}
              onExitPlanning={() => {
                setShowAddMorePlaces(false);
                setIsChangingHotel(false);
                setIsPlanning(false);
              }}
              onFocusMap={handleSelectAttraction}
              onSelectHotel={handleSelectHotel}
              showAddMorePlaces={showAddMorePlaces}
              setShowAddMorePlaces={setShowAddMorePlaces}
              isChangingHotel={isChangingHotel}
              setIsChangingHotel={setIsChangingHotel}
              onOpenBooking={() => setIsBooking(true)}
              isFullTripMapOpen={showFullTripMap}
              onToggleFullTripMap={() => {
                setShowFullTripMap((v) => !v);
                document.querySelector(".workspace-map-col")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onOpenSunshine={() => setIsSunshineOpen(true)}
            />
          ) : (
            <div className="exploration-tabs-shell">
              {/* Top-Level Tabs: Overview | Attractions | Hotels | Transport */}
              <div className="top-level-tabs-nav">
                <button
                  type="button"
                  className={`tab-nav-btn ${activeTab === "overview" ? "active" : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`tab-nav-btn ${activeTab === "attractions" ? "active" : ""}`}
                  onClick={() => setActiveTab("attractions")}
                >
                  Attractions {attractions.length > 0 && `(${attractions.length})`}
                </button>
                <button
                  type="button"
                  className={`tab-nav-btn ${activeTab === "hotels" ? "active" : ""}`}
                  onClick={() => setActiveTab("hotels")}
                >
                  Hotels
                </button>
                <button
                  type="button"
                  className="tab-sunshine-btn"
                  onClick={() => setIsSunshineOpen(true)}
                  title="Ask Sunshine about what's on your screen!"
                >
                  ☀️ Ask Sunshine
                </button>
              </div>

              {/* Tab Panel Contents */}
              <div className="tab-panel-container">
                {activeTab === "overview" && (
                  <DestinationOverview
                    destination={destination}
                    attractions={attractions}
                    onExploreAttractions={() => setActiveTab("attractions")}
                    onStartPlanning={() => setIsPlanning(true)}
                  />
                )}

                {activeTab === "attractions" && (
                  <AttractionsList
                    attractions={attractions}
                    hotelDistances={hotelDistances}
                    onFocusMap={handleSelectAttraction}
                    onStartPlanning={() => setIsPlanning(true)}
                    focusedAttraction={inspectedAttraction}
                  />
                )}

                {activeTab === "hotels" && (
                  <HotelsList
                    hotels={hotels}
                    attractions={attractions}
                    arrivalHub={trip.arrivalHub}
                    selectedHotel={inspectedHotel || trip.selectedHotel}
                    onSelectHotel={handleSelectHotel}
                    onFocusMap={handleFocusHotelOnMap}
                    onContinueToTrip={() => setIsPlanning(true)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      <SunshineWorkspaceModal
        isOpen={isSunshineOpen}
        onClose={() => setIsSunshineOpen(false)}
        destination={destination}
        weather={screenWeather}
        attractions={attractions}
        hotels={hotels}
        transportHubs={transportHubs}
        onApplyItinerary={() => {
          setActiveTab("overview");
        }}
      />
    </section>
  );
}
