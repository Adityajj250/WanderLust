import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import MapView from "../components/MapView.jsx";
import DestinationOverview from "../components/DestinationOverview.jsx";
import AttractionsList from "../components/AttractionsList.jsx";
import HotelsList from "../components/HotelsList.jsx";
import TransportView from "../components/TransportView.jsx";
import TripPlannerFlow from "../components/TripPlannerFlow.jsx";
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
  } = useTrip();

  const [status, setStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState("");

  const [destination, setDestination] = useState(null);
  const [attractions, setAttractions] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [transportHubs, setTransportHubs] = useState([]);

  // Top-Level Workspace Tabs: 'overview' | 'attractions' | 'hotels' | 'transport'
  const [activeTab, setActiveTab] = useState("overview");

  // Map Filter: 'all' | 'attractions' | 'hotels' | 'transport'
  const [mapLayer, setMapLayer] = useState("all");

  // Inspected items on map
  const [inspectedHotel, setInspectedHotel] = useState(null);
  const [inspectedAttraction, setInspectedAttraction] = useState(null);
  const [hotelDistances, setHotelDistances] = useState([]);

  // State for adding more places and changing hotel during planning
  const [showAddMorePlaces, setShowAddMorePlaces] = useState(false);
  const [isChangingHotel, setIsChangingHotel] = useState(false);

  // Load destination + POIs
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setErrorMessage("");

      try {
        const dest = await geocodeDestination(query);
        if (cancelled) return;
        setDestination(dest);

        const [attractionsData, hotelsData, transportData] = await Promise.all([
          fetchAttractions(query, dest.lat, dest.lon),
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
        if (cancelled) return;
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
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle hotel inspection / distance calculation
  const handleSelectHotel = useCallback(
    async (hotel) => {
      setInspectedHotel(hotel);
      selectHotel(hotel);
      try {
        const d = await fetchDistances(hotel, attractions);
        setHotelDistances(d || []);
      } catch (err) {
        console.error(err);
      }
    },
    [attractions, selectHotel]
  );

  const handleSelectAttraction = useCallback((attraction) => {
    setInspectedAttraction(attraction);
  }, []);

  const handleSelectHub = useCallback(
    (hub) => {
      selectArrivalHub(hub);
    },
    [selectArrivalHub]
  );

  // Determine active route for the map
  const activeRoute = useMemo(() => {
    // If in planning mode at transport step (Step 3) or final step (Step 5)
    if (trip.isPlanning && (trip.currentPlanStep === 3 || trip.currentPlanStep === 5)) {
      if (trip.arrivalHub && trip.selectedHotel) {
        return {
          from: [trip.arrivalHub.lat, trip.arrivalHub.lon],
          to: [trip.selectedHotel.lat, trip.selectedHotel.lon],
          label: (
            <>
              <strong>{trip.arrivalHub.name}</strong> ➔ <strong>{trip.selectedHotel.name}</strong>
            </>
          ),
          distText: trip.selectedHotel.distToArrival ? `${trip.selectedHotel.distToArrival} km` : "",
        };
      }
    }
    return null;
  }, [trip.isPlanning, trip.currentPlanStep, trip.arrivalHub, trip.selectedHotel]);

  const selectedCount = trip.selectedAttractions.length;

  // Map Attractions:
  // Once the user has selected tourist spots and proceeds to hotels (step >= 2),
  // stop showing other tourist spots and just show him spots he selected!
  // When he wants to add more, show all places.
  const mapAttractions = useMemo(() => {
    if (trip.isPlanning && trip.currentPlanStep >= 2 && trip.selectedAttractions.length > 0 && !showAddMorePlaces) {
      return trip.selectedAttractions;
    }
    return attractions;
  }, [trip.isPlanning, trip.currentPlanStep, trip.selectedAttractions, attractions, showAddMorePlaces]);

  // Map Hotels:
  // Once user selects a hotel, don't show other hotels!
  // If user is currently changing hotel, show all hotels.
  const mapHotels = useMemo(() => {
    if (trip.isPlanning && trip.selectedHotel && !isChangingHotel) {
      return [trip.selectedHotel];
    }
    return hotels;
  }, [trip.isPlanning, trip.selectedHotel, isChangingHotel, hotels]);

  if (status === "loading") {
    return (
      <div className="status-loading-shell">
        <div className="status-spinner" />
        <p className="status-message">
          Gathering destination sights, accommodations, and transit for <strong>"{query}"</strong>…
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

      {/* ── Two-Column Persistent Layout ──────────────────────────────────── */}
      <div className="workspace-columns-layout">
        {/* Left Column: Persistent Interactive Map */}
        <div className="workspace-map-col">
          {/* Map Layer Controls */}
          <div className="map-layer-filter-bar">
            <span className="filter-title">Layers:</span>
            <div className="layer-pill-buttons">
              <button
                type="button"
                className={`layer-pill ${mapLayer === "all" ? "active" : ""}`}
                onClick={() => setMapLayer("all")}
              >
                🌐 All
              </button>
              <button
                type="button"
                className={`layer-pill ${mapLayer === "attractions" ? "active" : ""}`}
                onClick={() => setMapLayer("attractions")}
              >
                🏛️ Sights
              </button>
              <button
                type="button"
                className={`layer-pill ${mapLayer === "hotels" ? "active" : ""}`}
                onClick={() => setMapLayer("hotels")}
              >
                🏨 Hotels
              </button>
              <button
                type="button"
                className={`layer-pill ${mapLayer === "transport" ? "active" : ""}`}
                onClick={() => setMapLayer("transport")}
              >
                🚆 Transit
              </button>
            </div>
          </div>

          <MapView
            center={destination}
            attractions={mapAttractions}
            hotels={mapHotels}
            transportHubs={transportHubs}
            activeLayer={mapLayer}
            selectedHotel={inspectedHotel || trip.selectedHotel}
            selectedAttraction={inspectedAttraction}
            arrivalPoint={trip.arrivalHub}
            activeRoute={activeRoute}
            onSelectHotel={handleSelectHotel}
            onSelectAttraction={handleSelectAttraction}
            onSelectTransportHub={handleSelectHub}
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
              showAddMorePlaces={showAddMorePlaces}
              setShowAddMorePlaces={setShowAddMorePlaces}
              isChangingHotel={isChangingHotel}
              setIsChangingHotel={setIsChangingHotel}
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
                  className={`tab-nav-btn ${activeTab === "transport" ? "active" : ""}`}
                  onClick={() => setActiveTab("transport")}
                >
                  Transport
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
                  />
                )}

                {activeTab === "hotels" && (
                  <HotelsList
                    hotels={hotels}
                    attractions={attractions}
                    arrivalHub={trip.arrivalHub}
                    selectedHotel={inspectedHotel || trip.selectedHotel}
                    onSelectHotel={handleSelectHotel}
                    onContinueToTrip={() => setIsPlanning(true)}
                  />
                )}

                {activeTab === "transport" && (
                  <TransportView
                    destination={destination}
                    transportHubs={transportHubs}
                    hotels={hotels}
                    onSelectHub={handleSelectHub}
                    onStartPlanning={() => setIsPlanning(true)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}