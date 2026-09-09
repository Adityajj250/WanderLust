# 🧭 WanderLust — AI-Powered Travel Planner

WanderLust is a full-stack (MERN) travel-planning app. Search any place in the
world, see it come alive on an OpenStreetMap map with curated attractions,
hotels, and transport hubs, then walk through a guided 5-step planner (sights →
hotel → arrival → local transport → final itinerary) — or skip straight to a
Gemini-generated day-by-day AI itinerary.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Frontend Architecture](#frontend-architecture)
- [Extending the App](#extending-the-app)
- [Attribution](#attribution)

## Features

- 🔍 **Destination search** — geocode any place name via OpenStreetMap Nominatim.
- 🗺️ **Interactive map** — Leaflet/OpenStreetMap view with custom markers for
  attractions, hotels, and transport hubs, plus optional road-route polylines
  (via the public OSRM demo server).
- 🏛️ **Curated attractions** — a AI-powered "top 20 iconic sights" list is
  geocoded and plotted, with an OpenStreetMap Overpass-based backup and an
  offline mock fallback if the AI or network is unavailable.
- 🏨 **Hotels** — sourced from OpenStreetMap Overpass, with deterministic
  synthesized pricing, ratings, amenities, and booking links (falls back to
  fully mock data if Overpass has no results).
- 🚉 **Transport hubs** — airports, railway stations, bus stations/stops near
  the destination, also from Overpass with a mock fallback.
- 📏 **Distance calculation** — haversine straight-line distance from a hotel
  (or any origin) to every attraction, with a documented upgrade path to real
  road distances via OSRM.
- 🧮 **Location scoring engine** — client-side scoring (`locationScore.js`)
  that ranks hotels by proximity to your selected sights, the arrival
  terminal, and price-to-quality value.
- 🧭 **5-step guided trip planner** (`TripPlannerFlow.jsx`) — pick sights →
  choose a hotel → set arrival mode/terminal → pick a local cab type → review
  a full cost & itinerary summary, with a live running trip cost and
  auto-persisted state.
- ✨ **AI trip planner** — generates a full markdown itinerary (day-by-day
  schedule, where to stay, transport advice, local cuisine, practical tips,
  and a recommended-places checklist) using 's AI API, then parses
  it into an interactive itinerary view that can seed the map/planner
  directly.
- ⚖️ **Hotel comparison panel** — pin multiple hotels side-by-side by price,
  rating, and distance.
- 🌗 **Dark/light theme**, persisted across sessions.
- 💾 **LocalStorage-backed trip state** so an in-progress plan survives page
  refreshes, plus **MongoDB-backed API caching** so repeat destination
  searches don't re-hit external services.

## Tech Stack

| Layer      | Technology                                                             |
|------------|-------------------------------------------------------------------------|
| Frontend   | React 18 + Vite, React Router 7, React-Leaflet / Leaflet (OSM tiles)   |
| Backend    | Node.js + Express (ESM)                                               |
| Database   | MongoDB via Mongoose — caches geocoding / attraction / hotel / transport results |
| Geodata    | OpenStreetMap **Nominatim** (geocoding) + **Overpass API** (POIs)      |
| Routing    | **OSRM** public demo server (road-route polylines, frontend-only)      |
| HTTP client| Axios (both frontend and backend)                                     |

## Project Structure

```
WanderLust/
├── backend/
│   ├── config/
│   │   └── db.js                 MongoDB connection (non-blocking on failure)
│   ├── models/                   Mongoose schemas
│   │   ├── Destination.js        Cached geocoding results
│   │   ├── Attraction.js         Cached attractions (AI/Overpass/mock)
│   │   ├── Hotel.js              Cached hotels (Overpass/mock)
│   │   └── TransportHub.js       Cached transport hubs (Overpass/mock)
│   ├── routes/
│   │   ├── geocode.js            GET  /api/geocode?q=...
│   │   ├── attractions.js        GET  /api/attractions?lat=&lon=&destinationQuery=
│   │   ├── hotels.js             GET  /api/hotels?lat=&lon=&destinationQuery=
│   │   ├── transport.js          GET  /api/transport?lat=&lon=&destinationQuery=
│   │   ├── distance.js           POST /api/distance
│   │   └── ai.js                 POST /api/ai/plan-trip, /plan-trip-stream, /chat
│   ├── utils/
│   │   ├── haversine.js          Straight-line distance helper
│   │   └── mockData.js           Deterministic offline fallback generators
│   └── server.js                 Express app entry point
└── frontend/
    ├── index.html
    ├── vite.config.js            Dev server + /api proxy to :5000
    └── src/
        ├── api/api.js            Thin axios client for every backend route
        ├── context/TripContext.jsx  Global trip state (localStorage-persisted) + theme
        ├── pages/
        │   ├── Home.jsx           Landing/search page
        │   └── Destination.jsx    Main workspace: map + tabs + planner
        ├── components/
        │   ├── MapView.jsx            Leaflet map, markers, road-route polylines
        │   ├── DestinationOverview.jsx
        │   ├── AttractionsList.jsx / AttractionCard.jsx
        │   ├── HotelsList.jsx / HotelCard.jsx
        │   ├── TransportView.jsx / TransportHubCard.jsx
        │   ├── DistanceTable.jsx
        │   ├── ComparisonPanel.jsx
        │   ├── TripPlannerFlow.jsx    5-step guided trip planner (in-page)
        │   ├── TripPlannerWizard.jsx  Alternate/legacy standalone wizard flow
        │   ├── AiTripModal.jsx        AI trip-generation form/modal
        │   └── AiItineraryView.jsx    Renders parsed AI itinerary, day tabs
        ├── utils/
        │   ├── itineraryParser.js     Parses AI markdown itinerary → structured object
        │   └── locationScore.js       Hotel ranking/scoring engine
        └── styles/index.css
```

## How It Works

1. **Search** a destination on the Home page (or pick a popular chip: Udupi,
   Goa, Mysuru, Manali).
2. The backend **geocodes** the query via Nominatim to get lat/lon
   (`GET /api/geocode`), caching the result in MongoDB.
3. The `Destination` page fetches, in parallel:
   - **Attractions** — Tier 1 asks AI for the top 20 iconic sights, then
     geocodes/matches each one to real coordinates via Overpass and
     Nominatim (with a safe radial-offset fallback if geocoding fails). If
     AI is unavailable, Tier 2 falls back to an Overpass POI query scored
     by a popularity heuristic (Wikipedia/Wikidata links, UNESCO/heritage
     tags, category, etc.). If Overpass is also unreachable, Tier 3 falls
     back to deterministic offline mock data.
   - **Hotels** — queried from Overpass (`tourism=hotel|guest_house|motel|
     hostel|resort`), with deterministic synthesized price/rating/amenities/
     booking-link data layered on top (real hotel pricing has no free API),
     falling back to fully mock hotels if Overpass returns nothing.
   - **Transport hubs** — airports, railway stations, bus stations/stops from
     Overpass, prioritized by hub type, with a mock fallback.
   All three responses are cached in MongoDB per `destinationQuery` so repeat
   searches are instant and don't re-hit external APIs.
4. Everything is plotted on a **Leaflet/OpenStreetMap** map with custom
   marker icons; selecting a hotel or attraction can request an actual
   **road route** polyline from the public OSRM server (falls back to a
   straight line if OSRM is unreachable).
5. Selecting a hotel calls `POST /api/distance` to compute the **haversine
   distance** from that hotel to every attraction, shown in a distance table
   and on each attraction card.
6. **"Add to comparison"** lets the user pin several hotels side-by-side
   (price, rating, distance) via `ComparisonPanel`.
7. The **5-step Trip Planner** (`TripPlannerFlow`) walks the user through:
   Sights → Hotel → Arrival mode/terminal → Local cab type → Final review,
   computing a running cost estimate and persisting progress to
   `localStorage` via `TripContext`.
8. The **AI Plan** button opens `AiTripModal`, which calls
   `POST /api/ai/plan-trip` (AI) to generate a full markdown itinerary —
   parsed by `itineraryParser.js` into day-by-day cards, "where to stay",
   transport advice, local cuisine, tips, and a recommended-places checklist
   — with a "Build Trip on Map" action to seed the guided planner from the
   AI's picks.
9. Every hotel has a **Book Now** button pointing at a mock booking URL,
   structured so a real booking API/deep link can replace it without
   touching the UI.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB running locally, or a MongoDB Atlas connection string
- A [ AI API key](https://ai..dev/) (required — the backend
  throws on startup without `AI_API_KEY`)

### 1. Backend

```bash
cd backend
cp .env.example .env      # fill in MONGO_URI, AI_API_KEY, etc.
npm install
npm run dev                # nodemon, http://localhost:5000
```

MongoDB must be running for caching/persistence, but the API still starts and
serves live (uncached) requests if MongoDB is unreachable.

### 2. Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_BASE_URL, defaults to /api via the Vite proxy
npm install
npm run dev                # http://localhost:5173
```

Open http://localhost:5173, search a place (e.g. "Udupi"), and explore.

### Production build

```bash
cd frontend
npm run build     # outputs to frontend/dist
npm run preview   # serve the production build locally
```

## Environment Variables

### `backend/.env`

| Variable                | Description                                                        | Default (from `.env.example`) |
|--------------------------|----------------------------------------------------------------------|--------------------------------|
| `PORT`                   | Backend server port                                                  | `5000`                         |
| `MONGO_URI`               | MongoDB connection string                                            | `mongodb://127.0.0.1:27017/travel_planner` |
| `NOMINATIM_BASE_URL`      | Nominatim geocoding endpoint                                         | `https://nominatim.openstreetmap.org` |
| `OVERPASS_BASE_URL`       | Overpass API endpoint for POI queries                                | `https://overpass-api.de/api/interpreter` |
| `OSRM_BASE_URL`           | OSRM routing server (documented seam for future road-distance calls) | `https://router.project-osrm.org` |
| `NOMINATIM_USER_AGENT`    | Contact email/app name — **required** by Nominatim/Overpass usage policy | `travel-planner-prototype (you@example.com)` |
| `AI_API_KEY`          |  AI API key — **required**, server throws on startup without it | *(none — must be set)*         |

> ⚠️ **Never commit your `.env` file.** `.gitignore` already excludes it —
> use `.env.example` as the template and keep real keys out of source
> control.

### `frontend/.env`

| Variable              | Description                                             | Default |
|------------------------|-----------------------------------------------------------|---------|
| `VITE_API_BASE_URL`     | Base URL the frontend axios client calls                  | `/api` (proxied to `http://localhost:5000` by Vite in dev) |

## API Reference

All routes are mounted under `/api` by `backend/server.js`.

| Method | Route                     | Description |
|--------|-----------------------------|-------------|
| GET    | `/api/health`                | Health check — `{ status, timestamp }` |
| GET    | `/api/geocode?q=`             | Resolve a free-text place name to `{ query, displayName, lat, lon, boundingBox }` via Nominatim (cached) |
| GET    | `/api/attractions?lat=&lon=&destinationQuery=&radius=` | Curated attractions (AI + Overpass matching, Overpass-only backup, or mock fallback), cached |
| GET    | `/api/hotels?lat=&lon=&destinationQuery=&radius=` | Hotels from Overpass with synthesized pricing/ratings, or mock fallback, cached |
| GET    | `/api/transport?lat=&lon=&destinationQuery=` | Transport hubs (airports/rail/bus) from Overpass, or mock fallback, cached |
| POST   | `/api/distance`               | Body: `{ origin\|hotel, destinations\|attractions }` → haversine distance (km) from origin to each target, sorted ascending |
| POST   | `/api/ai/plan-trip`           | Body: `{ destination, days, interests, budget }` → full markdown itinerary + `recommendedPlaces` array, generated by AI |
| POST   | `/api/ai/plan-trip-stream`     | Same as above, streamed via Server-Sent Events |
| POST   | `/api/ai/chat`                 | Body: `{ message, previous_interaction_id }` → multi-turn AI conversation |

## Data Model

MongoDB collections (all indexed on `destinationQuery` / `query` for fast
cache lookups):

- **Destination** — cached geocoding result: `query`, `displayName`, `lat`,
  `lon`, `boundingBox`, plus the raw Nominatim payload.
- **Attraction** — `destinationQuery`, `name`, `category`, `description`,
  `lat`, `lon`, `imageUrl`, `source` (`overpass` | `mock`), `osmId`, `score`
  (popularity), `wikipedia`.
- **Hotel** — `destinationQuery`, `name`, `address`, `lat`, `lon`,
  `pricePerNight`, `currency`, `rating`, `imageUrl`, `amenities`,
  `bookingUrl`, `source` (`overpass` | `mock` | `partner-api`), `osmId`.
- **TransportHub** — `destinationQuery`, `name`, `type` (`Airport` |
  `Railway Station` | `Bus Station` | `Bus Stop`), `lat`, `lon`, `operator`,
  `source`, `osmId`.

## Frontend Architecture

- **`TripContext`** is the single source of truth for the active trip:
  destination, selected attractions, selected hotel, arrival hub, selected
  cab, ticket selections, current planner step, and UI state like the AI
  modal and theme. It's persisted to `localStorage` on every change, so a
  refresh mid-plan doesn't lose progress.
- **`Destination` page** owns data-fetching for the current place (via
  `src/api/api.js`) and renders a tabbed workspace (Overview / Attractions /
  Hotels / Transport) alongside the map, switching into the 5-step
  `TripPlannerFlow` once the user starts planning.
- **`locationScore.js`** independently re-implements haversine distance on
  the client to score/rank hotels by proximity to selected sights and the
  arrival terminal without an extra round-trip to the backend.
- **`itineraryParser.js`** turns the AI's markdown response into a
  structured object (`title`, `summary`, `days[]`, `whereToStay`,
  `transport`, `cuisine`, `tips`) for `AiItineraryView`'s tabbed rendering.
- **`TripPlannerWizard.jsx`** exists alongside `TripPlannerFlow.jsx` as an
  alternate/standalone planner flow with its own arrival and cab-type
  options — check current usage in `App.jsx`/`Destination.jsx` if
  consolidating the two.

## Extending the App

The codebase is intentionally seamed for these upgrades without touching
consuming code:

- **Real hotel inventory/pricing API** → replace `generateMockHotels` /
  `synthesizeHotelDetails` in `backend/utils/mockData.js`; keep the same
  document shape.
- **Real road distance/duration** → call OSRM from
  `backend/routes/distance.js` instead of `haversineDistanceKm`; the response
  shape (`{ name, distanceKm }`) can stay the same or gain `durationMin`.
  (The frontend already fetches OSRM road-route *geometry* client-side in
  `fetchRoadRoute` for map polylines — this is a separate concern from
  server-side distance calculation.)
- **User accounts / saved trips / itinerary persistence** → new Mongoose
  models + routes; the frontend already isolates all network calls in
  `src/api/api.js`.
- **Swap the AI model/provider** → `MODEL_NAME` in
  `backend/routes/ai.js`/`attractions.js` is a single constant
  (`AI-3.1-flash-lite`).

## Attribution

Map tiles and location data: © OpenStreetMap contributors, used under the
Nominatim and Overpass usage policies. Set `NOMINATIM_USER_AGENT` in
`backend/.env` to identify your app per Nominatim's usage policy. Road-route
geometry from the public OSRM demo server. Curated attraction lists and AI
itineraries generated by  AI.
