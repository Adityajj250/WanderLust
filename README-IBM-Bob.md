# Technology Used – IBM Bob

**Project:** WanderLust — AI-Powered Travel Planner
**Maximum:** 1000 words

---

## What Is IBM Bob?

IBM Bob is an AI-powered software engineering assistant embedded directly inside the development environment. It reads and writes real files in the workspace, applies precise code edits, runs terminal commands, tracks multi-step tasks, and grounds every answer in the actual codebase — not guesses. For WanderLust, IBM Bob was involved in roughly 60% of the total development work, spanning architecture planning, backend coding, frontend component development, utility logic, debugging, and documentation.

---

## 1. Architecture Planning

Before a single file was created, IBM Bob was used to design the entire project structure. Given the product goal — *a map-first travel planner with AI itineraries and a guided planner flow* — Bob:

- Produced the full `backend/` and `frontend/` folder layout
- Identified which logic belonged in **routes** vs **utilities** vs **context**
- Defined the four MongoDB models (`Destination`, `Attraction`, `Hotel`, `TransportHub`) and their cache-lookup indexes
- Decided which external APIs were needed and how to isolate them so each could be swapped independently
- Designed the three-tier fallback strategy for attractions (AI → Overpass → mock) before any code was written

This planning phase saved significant time — no structural refactors were needed at any later stage of the project.

---

## 2. Backend Development

IBM Bob wrote or co-wrote all six Express route modules and the supporting backend infrastructure:

### Routes

| File | What Bob built |
|---|---|
| `routes/geocode.js` | Nominatim integration with MongoDB cache-check; returns `{ displayName, lat, lon, boundingBox }` |
| `routes/attractions.js` | Full three-tier fallback chain — Gemini AI prompt → Overpass POI query with popularity scoring → deterministic mock; radial-offset geocoding fallback for unresolvable sights |
| `routes/hotels.js` | Overpass `tourism=hotel\|guest_house\|motel\|hostel\|resort` query; deterministic price/rating/amenity synthesis from OSM node ID; full mock fallback |
| `routes/transport.js` | Overpass hub query (airports, railway, bus) with type-priority sorting and mock fallback |
| `routes/distance.js` | Haversine endpoint — designed as a documented seam so OSRM road distances can replace it without touching the frontend |
| `routes/ai.js` | Gemini integration: full itinerary generation (`plan-trip`), streaming via Server-Sent Events (`plan-trip-stream`), and multi-turn chat (`chat`) |

### Supporting Files

- **`models/Destination.js`, `Attraction.js`, `Hotel.js`, `TransportHub.js`** — all four Mongoose schemas with correct index definitions written by Bob
- **`utils/haversine.js`** — straight-line distance helper
- **`utils/mockData.js`** — deterministic fallback generators (`generateMockHotels`, `synthesizeHotelDetails`) whose output is seeded from OSM node IDs so the same place always gets the same synthesized price and rating
- **`config/db.js`** — non-blocking MongoDB connection so the app starts and serves live data even when MongoDB is unreachable

---

## 3. Frontend Component Development

IBM Bob built the majority of the React component tree:

### State and Data Layer

- **`context/TripContext.jsx`** — global trip state context holding destination, selected attractions, selected hotel, arrival hub, cab type, planner step, comparison list, and theme. Hydrates from `localStorage` on mount and persists on every change so a mid-plan page refresh loses nothing.
- **`api/api.js`** — thin Axios wrapper exposing one function per backend route; all network calls are isolated here so no component imports Axios directly.

### Map

- **`components/MapView.jsx`** — Leaflet map with category-specific custom SVG markers, click handlers that update `TripContext`, and a `fetchRoadRoute` call to the OSRM public server that draws a real road polyline on selection (falls back silently to a straight line if OSRM is unreachable).

### Trip Planner

- **`components/TripPlannerFlow.jsx`** — the 5-step in-page wizard (Sights → Hotel → Arrival → Local Transport → Review) with live cost accumulation at every step, step-by-step validation, and a full cost-breakdown review screen. Entirely built by Bob from the step logic to the running-total calculation.

### AI Itinerary

- **`components/AiTripModal.jsx`** — the trip generation form; collects destination (pre-filled), days, interests, and budget, then calls the backend.
- **`components/AiItineraryView.jsx`** — tabbed itinerary renderer consuming the structured output of `itineraryParser.js`; one tab per day plus Overview, Accommodation, Transport, Food, and Tips tabs. The "Build Trip on Map" action matches the AI's `recommendedPlaces` against loaded attractions and selects them in `TripContext`.

### Other Components

`AttractionsList`, `AttractionCard`, `HotelsList`, `HotelCard`, `HotelCard` (with Compare and Select actions), `TransportView`, `TransportHubCard`, `DistanceTable`, `ComparisonPanel`, and `DestinationOverview` — all scaffolded and wired up by Bob to a consistent prop interface.

---

## 4. Utility Logic

Two non-trivial utility modules were written entirely by Bob:

**`utils/itineraryParser.js`**
Parses the raw Gemini markdown response into a typed JavaScript object:
```
{ title, summary, days[], whereToStay, transport, cuisine, tips, recommendedPlaces }
```
Uses regex and section-header detection to split the document into named sections and parse per-day activity lists. Written defensively to handle format variation in the AI's output across different prompt runs — every field has an empty-string or empty-array fallback so the renderer never needs to null-check.

**`utils/locationScore.js`**
Client-side hotel scoring engine. Re-runs haversine in the browser and scores every hotel across three weighted dimensions: proximity to selected sights, proximity to the arrival terminal, and price-to-quality ratio. Runs on every selection change so the hotel list re-ranks instantly without a backend round-trip.

---

## 5. Debugging

IBM Bob diagnosed and fixed several bugs during development. In every case it read the actual file before proposing a change — fixes were surgical one-line or two-line diffs, never full rewrites:

- **Overpass geometry inconsistency** — Overpass returns different geometry formats (node vs. way) across datasets. Bob spotted the mismatch in `attractions.js` and added a normalization step.
- **Vite proxy misconfiguration** — frontend `/api` calls were hitting the wrong port. Bob read `vite.config.js` and corrected the proxy target in one line.
- **Gemini markdown format drift** — the AI's response structure changed between prompt iterations. Bob updated `itineraryParser.js` to handle both the old and new section-heading formats without breaking existing parses.
- **`TripContext` hydration order bug** — context was rendering before `localStorage` was read, causing the initial state to always be empty. Bob traced the issue to the initialization order and applied the minimal fix.

---

## 6. Environment Config and Documentation

- Generated `.env.example` for both `backend/` and `frontend/` with descriptive inline comments for every variable
- Identified which variables are strictly required at startup (`AI_API_KEY`, `NOMINATIM_USER_AGENT`) vs. optional with safe defaults
- Wrote the full project `README.md` covering the project overview, tech stack, project structure, how-it-works walkthrough, setup instructions, environment variables, API reference, data model, frontend architecture, and the extension guide

---

## Summary

| Area | IBM Bob's Contribution |
|---|---|
| Architecture | Full folder layout, API design, MongoDB schema planning, fallback strategy design |
| Backend | All 6 Express routes, 4 Mongoose models, 2 utilities, MongoDB config |
| Frontend | `TripContext`, `MapView`, `TripPlannerFlow`, `AiTripModal`, `AiItineraryView`, `ComparisonPanel`, all card/list components, `api.js` |
| Utility logic | `itineraryParser.js` (full), `locationScore.js` (full) |
| Debugging | 4 bugs diagnosed and fixed with targeted diffs |
| Config & Docs | `.env.example` files, full README |

IBM Bob's involvement covered approximately **60% of the total codebase** — everything from the first architectural decision to the final documentation pass.
