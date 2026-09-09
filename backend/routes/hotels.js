import express from "express";
import axios from "axios";
import Hotel from "../models/Hotel.js";
import { generateMockHotels, synthesizeHotelDetails } from "../utils/mockData.js";

const router = express.Router();
const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL || "https://overpass-api.de/api/interpreter";

function buildHotelsOverpassQuery(lat, lon, radiusMeters = 12000) {
  return `
    [out:json][timeout:25];
    (
      nwr["tourism"~"hotel|guest_house|motel|hostel|resort"](around:${radiusMeters},${lat},${lon});
    );
    out tags center 80;
  `;
}

/**
 * GET /api/hotels?lat=..&lon=..&destinationQuery=Udupi
 * Fetches real accommodation data from OpenStreetMap via Overpass API.
 * Synthesizes deterministic rates, amenities and ratings so price sorting
 * and side-by-side comparison features work seamlessly.
 */
router.get("/", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const destinationQuery = (req.query.destinationQuery || "").trim().toLowerCase();
  const radius = parseInt(req.query.radius || "12000", 10);

  if (Number.isNaN(lat) || Number.isNaN(lon) || !destinationQuery) {
    return res.status(400).json({ error: "lat, lon, and destinationQuery are required." });
  }

  // Best-effort cache lookup
  try {
    const cached = await Hotel.find({ destinationQuery }).limit(30).catch(() => []);
    if (cached.length) {
      return res.json({ fromCache: true, hotels: cached });
    }
  } catch (_) {}

  try {
    const query = buildHotelsOverpassQuery(lat, lon, radius);
    const response = await axios.post(OVERPASS_BASE_URL, query, {
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": process.env.NOMINATIM_USER_AGENT || "WanderLust/1.0",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    const elements = response.data?.elements || [];

    const rawHotels = elements
      .filter((el) => el.tags && (el.tags.name || el.tags["name:en"]))
      .map((el, i) => {
        const latitude = el.lat ?? el.center?.lat;
        const longitude = el.lon ?? el.center?.lon;
        const name = el.tags["name:en"] || el.tags.name;
        const details = synthesizeHotelDetails(name, { ...el.tags, osmId: `${el.type}/${el.id}` }, destinationQuery);

        return {
          destinationQuery,
          name,
          address: details.address,
          lat: latitude,
          lon: longitude,
          pricePerNight: details.pricePerNight,
          currency: "INR",
          rating: details.rating,
          imageUrl: `https://picsum.photos/seed/${encodeURIComponent(name + i)}/400/250`,
          amenities: details.amenities,
          bookingUrl: details.bookingUrl,
          source: "overpass",
          osmId: `${el.type}/${el.id}`,
        };
      })
      .filter((h) => h.lat !== undefined && h.lon !== undefined);

    // Deduplicate identical names
    const seen = new Set();
    const uniqueHotels = [];
    for (const h of rawHotels) {
      const lower = h.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueHotels.push(h);
      }
    }

    const hotels = uniqueHotels.slice(0, 25);

    if (!hotels.length) throw new Error("No named hotels returned by Overpass.");

    try {
      await Hotel.insertMany(hotels, { ordered: false });
    } catch (_) {}

    res.json({ fromCache: false, hotels });
  } catch (err) {
    console.warn("[hotels] Overpass failed, using mock data:", err.message);
    const mockHotels = generateMockHotels(destinationQuery, lat, lon);
    try {
      await Hotel.insertMany(mockHotels, { ordered: false });
    } catch (_) {}
    res.json({ fromCache: false, hotels: mockHotels, mock: true });
  }
});

export default router;
