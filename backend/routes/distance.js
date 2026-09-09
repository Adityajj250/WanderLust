import express from "express";
import { haversineDistanceKm, round1 } from "../utils/haversine.js";

const router = express.Router();

/**
 * POST /api/distance
 * body: { hotel: {lat, lon}, attractions: [{ id/name, lat, lon }, ...] }
 *
 * Returns straight-line distance (km) from the hotel to each attraction.
 *
 * FUTURE UPGRADE PATH: to use real road distance, replace the haversine call
 * below with a call to OSRM's /route/v1/driving/{lon1},{lat1};{lon2},{lat2}
 * endpoint (see OSRM_BASE_URL in .env) and return `distance`/`duration` from
 * its response instead. The response shape below is intentionally kept
 * generic ({ name, distanceKm }) so the frontend doesn't need to change.
 */
router.post("/", (req, res) => {
  const { hotel, attractions, origin, destinations } = req.body || {};
  const start = origin || hotel;
  const targets = destinations || attractions;

  if (!start || typeof start.lat !== "number" || typeof start.lon !== "number") {
    return res.status(400).json({ error: "origin or hotel with numeric lat/lon is required." });
  }
  if (!Array.isArray(targets)) {
    return res.status(400).json({ error: "destinations or attractions must be an array." });
  }

  const distances = targets.map((a) => ({
    id: a.id || a._id || a.osmId || a.name,
    name: a.name,
    distanceKm: round1(haversineDistanceKm(start.lat, start.lon, a.lat, a.lon)),
    lat: a.lat,
    lon: a.lon,
  }));

  distances.sort((a, b) => a.distanceKm - b.distanceKm);

  res.json({
    origin: { name: start.name, lat: start.lat, lon: start.lon },
    hotel: { lat: start.lat, lon: start.lon },
    distances,
    method: "haversine",
  });
});

export default router;
