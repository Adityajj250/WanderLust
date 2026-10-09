import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const client = axios.create({ baseURL: API_BASE_URL });

export async function geocodeDestination(query) {
  const { data } = await client.get("/geocode", { params: { q: query } });
  return data.destination;
}

export async function fetchAttractions(destinationQuery, lat, lon, { days, travellers, interests } = {}, signal) {
  const { data } = await client.get("/attractions", {
    params: { destinationQuery, lat, lon, days, travellers, interests, _t: Date.now() },
    signal,
  });
  return data.attractions;
}

export async function fetchHotels(destinationQuery, lat, lon) {
  const { data } = await client.get("/hotels", {
    params: { destinationQuery, lat, lon },
  });
  return data.hotels;
}

export async function fetchTransportHubs(destinationQuery, lat, lon) {
  const { data } = await client.get("/transport", {
    params: { destinationQuery, lat, lon },
  });
  return data.transportHubs;
}

export async function fetchDistances(origin, destinations) {
  // Backwards-compatible payload
  const payload = {
    origin,
    destinations,
    hotel: origin,
    attractions: destinations,
  };
  const { data } = await client.post("/distance", payload);
  return data.distances;
}

/**
 * Fetch an actual road route between two lat/lon points using the free public
 * OSRM demo server. Returns an array of [lat, lon] pairs describing the road
 * geometry, or null if the request fails (caller falls back to straight line).
 *
 * OSRM URL format: /route/v1/driving/{lon1},{lat1};{lon2},{lat2}?geometries=geojson&overview=simplified
 */
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/**
 * Returns { coords: [[lat,lon],...], distanceM: number } or null on failure.
 * `distanceM` is the road distance in metres as reported by OSRM.
 */
export async function fetchRoadRoute(fromLat, fromLon, toLat, toLon) {
  try {
    const url = `${OSRM_BASE}/${fromLon},${fromLat};${toLon},${toLat}?geometries=geojson&overview=simplified`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code !== "Ok" || !json.routes?.length) return null;
    const route = json.routes[0];
    // GeoJSON coordinates are [lon, lat]; Leaflet needs [lat, lon]
    const coords = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    return { coords, distanceM: route.distance };
  } catch {
    return null;
  }
}

export async function generateAiTripPlan({ destination, days = 3, interests, budget }) {
  const { data } = await client.post("/ai/plan-trip", {
    destination,
    days,
    interests,
    budget,
  });
  return data;
}

export async function askSunshineHome({ messages }) {
  const { data } = await client.post("/ai/sunshine/home-chat", { messages });
  return data;
}

export async function askSunshineWorkspace({ messages, screenContext }) {
  const { data } = await client.post("/ai/sunshine/workspace-chat", {
    messages,
    screenContext,
  });
  return data;
}

