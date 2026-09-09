import React from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { TripProvider, useTrip } from "./context/TripContext.jsx";
import Home from "./pages/Home.jsx";
import Destination from "./pages/Destination.jsx";
import AiTripModal from "./components/AiTripModal.jsx";

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="status-message error">
          <p>Something went wrong. Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}



function AppHeader() {
  const { trip, openAiModal, setIsPlanning, theme, toggleTheme } = useTrip();
  const navigate = useNavigate();

  function handleMyTripClick() {
    if (trip.destination?.query) {
      setIsPlanning(true);
      navigate(`/destination/${encodeURIComponent(trip.destination.query)}`);
    } else {
      // Default to exploring or start with a sample place
      navigate("/");
    }
  }

  const tripPlacesCount = trip.selectedAttractions?.length || 0;

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="brand">
          <span className="brand-icon">🧭</span>
          <span className="brand-text">WanderLust</span>
        </Link>
      </div>

      <nav className="global-nav">
        <Link to="/" className="nav-item">
          Explore
        </Link>

        <button
          type="button"
          className={`nav-item nav-btn-trip ${tripPlacesCount > 0 ? "has-items" : ""}`}
          onClick={handleMyTripClick}
          title="View your active trip plan"
        >
          My Trip
          {tripPlacesCount > 0 && <span className="nav-badge">{tripPlacesCount}</span>}
        </button>

        <button
          type="button"
          className="nav-item nav-btn-ai"
          onClick={() => openAiModal(trip.destination?.query || "")}
        >
          ✨ AI Plan
        </button>

        <button
          type="button"
          className="nav-item nav-btn-theme"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}
          aria-label="Toggle color theme"
        >
          <span className="theme-toggle-icon">{theme === "dark" ? "☀️" : "🌙"}</span>
          <span className="theme-toggle-text">{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
      </nav>
    </header>
  );
}

function MainContent() {
  const { isAiModalOpen, closeAiModal, aiModalInitialDest } = useTrip();

  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/destination/:query" element={<Destination />} />
        </Routes>
      </main>

      <AiTripModal
        isOpen={isAiModalOpen}
        onClose={closeAiModal}
        initialDestination={aiModalInitialDest}
      />

      <footer className="app-footer">
        Map data &copy; OpenStreetMap contributors · WanderLust
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <TripProvider>
      <MainContent />
    </TripProvider>
  );
}

