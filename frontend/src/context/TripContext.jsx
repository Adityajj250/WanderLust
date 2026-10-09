import React, { createContext, useContext, useState, useEffect } from "react";

const TripContext = createContext(null);

const STORAGE_KEY = "travel_planner_trip_data";

export function TripProvider({ children }) {
  // Clear any legacy localStorage data so everything starts fresh
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("wanderlust_booking_state");
  } catch (_) {}

  const [trip, setTrip] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      destination: null, // { query, displayName, lat, lon }
      durationDays: 3,
      startDate: "",
      endDate: "",
      travellers: 1,
      selectedAttractions: [], // array of attraction objects
      selectedHotel: null,
      arrivalHub: null, // { name, type, lat, lon }
      selectedCab: null, // { id, name, fare, distanceKm }
      tickets: {}, // { [attractionId]: { qty, price, name } }
      currentPlanStep: 1,
      isPlanning: false,
    };
  });

  // Global AI Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalInitialDest, setAiModalInitialDest] = useState("");

  // Dark / Light Theme State (default to 'dark')
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("travel_planner_theme");
      if (saved) return saved;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch (_) {}
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("travel_planner_theme", theme);
    } catch (_) {}
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
    } catch (_) {}
  }, [trip]);

  // Clean backend cache & session data when window or session ends
  useEffect(() => {
    const handleSessionEnd = () => {
      try {
        sessionStorage.clear();
        navigator.sendBeacon("/api/session/reset");
      } catch (_) {}
    };

    window.addEventListener("pagehide", handleSessionEnd);
    return () => window.removeEventListener("pagehide", handleSessionEnd);
  }, []);

  function initDestination(dest, initialAttractions = [], initialIsPlanning = false) {
    setTrip((prev) => {
      const isNew = !prev.destination || prev.destination.query?.toLowerCase() !== dest?.query?.toLowerCase();
      return {
        ...prev,
        destination: dest,
        selectedAttractions: initialAttractions.length > 0 ? initialAttractions : (isNew ? [] : prev.selectedAttractions),
        selectedHotel: isNew ? null : prev.selectedHotel,
        arrivalHub: isNew ? null : prev.arrivalHub,
        selectedCab: isNew ? null : prev.selectedCab,
        tickets: isNew ? {} : prev.tickets,
        currentPlanStep: 1,
        isPlanning: initialIsPlanning,
      };
    });
  }

  function setDurationDays(days) {
    setTrip((prev) => ({ ...prev, durationDays: Math.max(1, Math.min(30, Number(days) || 1)) }));
  }

  function setTripDates({ startDate, endDate }) {
    setTrip((prev) => {
      let days = prev.durationDays;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > 0) {
          days = Math.min(30, diffDays);
        }
      }
      return {
        ...prev,
        startDate: startDate !== undefined ? startDate : prev.startDate,
        endDate: endDate !== undefined ? endDate : prev.endDate,
        durationDays: days,
      };
    });
  }

  function setTravellers(count) {
    setTrip((prev) => ({ ...prev, travellers: Math.max(1, Math.min(50, Number(count) || 1)) }));
  }

  function addAttraction(attraction) {
    setTrip((prev) => {
      const key = attraction._id || attraction.osmId || attraction.name;
      if (prev.selectedAttractions.some((a) => (a._id || a.osmId || a.name) === key)) {
        return prev;
      }
      return {
        ...prev,
        selectedAttractions: [...prev.selectedAttractions, attraction],
      };
    });
  }

  function toggleAttraction(attraction) {
    setTrip((prev) => {
      const key = attraction._id || attraction.osmId || attraction.name;
      const exists = prev.selectedAttractions.some((a) => (a._id || a.osmId || a.name) === key);
      if (exists) {
        const filtered = prev.selectedAttractions.filter(
          (a) => (a._id || a.osmId || a.name) !== key
        );
        const updatedTickets = { ...prev.tickets };
        delete updatedTickets[key];
        return {
          ...prev,
          selectedAttractions: filtered,
          tickets: updatedTickets,
        };
      } else {
        return {
          ...prev,
          selectedAttractions: [...prev.selectedAttractions, attraction],
        };
      }
    });
  }

  function selectAllAttractions(attractionsList) {
    setTrip((prev) => ({
      ...prev,
      selectedAttractions: attractionsList || [],
    }));
  }

  function clearAttractions() {
    setTrip((prev) => ({
      ...prev,
      selectedAttractions: [],
      tickets: {},
    }));
  }

  function removeAttraction(attractionKey) {
    setTrip((prev) => {
      const filtered = prev.selectedAttractions.filter(
        (a) => (a._id || a.osmId || a.name) !== attractionKey
      );
      const updatedTickets = { ...prev.tickets };
      delete updatedTickets[attractionKey];
      return {
        ...prev,
        selectedAttractions: filtered,
        tickets: updatedTickets,
      };
    });
  }

  function selectHotel(hotel) {
    setTrip((prev) => ({ ...prev, selectedHotel: hotel }));
  }

  function selectArrivalHub(hub) {
    setTrip((prev) => ({ ...prev, arrivalHub: hub }));
  }

  function selectCab(cab) {
    setTrip((prev) => ({ ...prev, selectedCab: cab }));
  }

  function updateTickets(tickets) {
    setTrip((prev) => ({ ...prev, tickets }));
  }

  function setCurrentPlanStep(step) {
    setTrip((prev) => ({ ...prev, currentPlanStep: step }));
  }

  function setIsPlanning(bool) {
    setTrip((prev) => ({ ...prev, isPlanning: bool }));
  }

  function openAiModal(initialDest = "") {
    setAiModalInitialDest(initialDest);
    setIsAiModalOpen(true);
  }

  function closeAiModal() {
    setIsAiModalOpen(false);
  }

  return (
    <TripContext.Provider
      value={{
        trip,
        initDestination,
        setDurationDays,
        setTripDates,
        setTravellers,
        addAttraction,
        toggleAttraction,
        selectAllAttractions,
        clearAttractions,
        removeAttraction,
        selectHotel,
        selectArrivalHub,
        selectCab,
        updateTickets,
        setCurrentPlanStep,
        setIsPlanning,
        isAiModalOpen,
        aiModalInitialDest,
        openAiModal,
        closeAiModal,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTrip must be used within a TripProvider");
  }
  return context;
}
