import express from "express";
import axios from "axios";
import Destination from "../models/Destination.js";

const router = express.Router();

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || "travel-planner-prototype";

/**
 * GET /api/geocode?q=Udupi
 * Resolves a free-text area name to coordinates using OpenStreetMap Nominatim.
 * Caches results in MongoDB (best-effort — cache failures don't block the response).
 */
router.get("/", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  try {
    // Best-effort cache lookup — ignore DB errors if MongoDB isn't connected.
    try {
      const cached = await Destination.findOne({ query: q.toLowerCase() }).sort({ createdAt: -1 });
      if (cached) {
        return res.json({ fromCache: true, destination: formatDestination(cached) });
      }
    } catch (_) {}

    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params: { q, format: "jsonv2", addressdetails: 1, limit: 1 },
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
    });

    const result = response.data?.[0];
    if (!result) {
      return res.status(404).json({ error: `No location found for "${q}".` });
    }

    const doc = {
      query: q.toLowerCase(),
      displayName: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      boundingBox: (result.boundingbox || []).map(Number),
      placeId: String(result.place_id || ""),
      osmType: result.osm_type,
      osmId: String(result.osm_id || ""),
      raw: result,
    };

    // Best-effort cache write.
    try {
      await Destination.create(doc);
    } catch (_) {}

    res.json({ fromCache: false, destination: formatDestination(doc) });
  } catch (err) {
    console.error("[geocode] error:", {
  message: err.message,
  status: err.response?.status,
  data: err.response?.data,
});
    res.status(502).json({ error: "Failed to reach the geocoding service (Nominatim)." });
  }
});

function formatDestination(d) {
  return {
    query: d.query,
    displayName: d.displayName,
    lat: d.lat,
    lon: d.lon,
    boundingBox: d.boundingBox,
  };
}

export default router;
