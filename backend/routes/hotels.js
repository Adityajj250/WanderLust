import express from "express";
import axios from "axios";
import Hotel from "../models/Hotel.js";
import { generateMockHotels, synthesizeHotelDetails } from "../utils/mockData.js";

const router = express.Router();

const OVERPASS_ENDPOINTS = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Primary: Query hotels, hostels, guest houses, campsites, and resorts inside city area.
 */
function buildCityAreaOverpassQuery(cityName) {
  const cleanCity = cityName.split(",")[0].trim();
  return `
    [out:json][timeout:25];
    area["name"="${cleanCity}"]->.searchArea;
    (
      nwr["tourism"="hotel"](area.searchArea);
      nwr["tourism"="hostel"](area.searchArea);
      nwr["tourism"="guest_house"](area.searchArea);
      nwr["tourism"="camp_site"](area.searchArea);
      nwr["tourism"="resort"](area.searchArea);
      nwr["leisure"="resort"](area.searchArea);
      nwr["tourism"="motel"](area.searchArea);
    );
    out tags center 70;
  `;
}

/**
 * Secondary: Fallback to coordinate-based radius search around center coordinates
 */
function buildHotelsAroundOverpassQuery(lat, lon, radiusMeters = 5000) {
  return `
    [out:json][timeout:25];
    (
      nwr["tourism"="hotel"](around:${radiusMeters},${lat},${lon});
      nwr["tourism"="hostel"](around:${radiusMeters},${lat},${lon});
      nwr["tourism"="guest_house"](around:${radiusMeters},${lat},${lon});
      nwr["tourism"="camp_site"](around:${radiusMeters},${lat},${lon});
      nwr["tourism"="resort"](around:${radiusMeters},${lat},${lon});
      nwr["leisure"="resort"](around:${radiusMeters},${lat},${lon});
      nwr["tourism"="motel"](around:${radiusMeters},${lat},${lon});
    );
    out tags center 70;
  `;
}

function getHotelCategoryAndIcon(tags = {}) {
  if (tags.tourism === "hostel") return { type: "Hostel", icon: "🛏️" };
  if (tags.tourism === "guest_house") return { type: "Guest House", icon: "🏠" };
  if (tags.tourism === "camp_site") return { type: "Campsite", icon: "🏕️" };
  if (tags.tourism === "resort" || tags.leisure === "resort") return { type: "Beach Resort", icon: "🏝️" };
  if (tags.tourism === "motel") return { type: "Motel", icon: "🏨" };
  return { type: "Hotel", icon: "🏨" };
}

/**
 * Execute an Overpass query with failover across available mirrors
 */
async function executeOverpassQuery(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await axios.post(endpoint, query, {
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": process.env.NOMINATIM_USER_AGENT || "WanderLust/1.0",
          Accept: "application/json",
        },
        timeout: 12000,
      });
      const elements = response.data?.elements || [];
      const named = elements.filter((el) => el.tags && (el.tags.name || el.tags["name:en"]));
      if (named.length > 0) {
        return { elements: named, endpoint };
      }
    } catch (err) {
      console.warn(`[hotels] Overpass mirror failed (${endpoint}): ${err.message}`);
    }
  }
  return { elements: [], endpoint: null };
}

/**
 * Tertiary fallback: Real OSM places from Nominatim if Overpass is down
 */
async function fetchNominatimHotels(cityName, destinationQuery) {
  const cleanCity = cityName.split(",")[0].trim();
  const nomUrl = `${process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org"}/search?q=hotel+in+${encodeURIComponent(cleanCity)}&format=json&limit=30`;
  const res = await axios.get(nomUrl, {
    headers: { "User-Agent": process.env.NOMINATIM_USER_AGENT || "WanderLust/1.0" },
    timeout: 8000,
  });
  const data = res.data || [];
  return data
    .filter((item) => item.lat && item.lon && item.display_name)
    .map((item, i) => {
      const name = item.display_name.split(",")[0].trim();
      const details = synthesizeHotelDetails(name, { name, osmId: `${item.osm_type || "node"}/${item.osm_id}` }, destinationQuery);
      return {
        destinationQuery,
        name,
        address: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        pricePerNight: details.pricePerNight,
        currency: "INR",
        rating: details.rating,
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(name + i)}/400/250`,
        amenities: details.amenities,
        bookingUrl: details.bookingUrl,
        source: "osm_nominatim",
        osmId: `${item.osm_type || "node"}/${item.osm_id}`,
      };
    });
}

/**
 * GET /api/hotels?lat=..&lon=..&destinationQuery=Paris
 * Fetches real hotel and accommodation data from OpenStreetMap.
 */
router.get("/", async (req, res) => {
  // Prevent browser caching of stale hotel data
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const destinationQuery = (req.query.destinationQuery || "").trim().toLowerCase();
  const radius = Math.min(parseInt(req.query.radius || "5000", 10), 5000);

  if (Number.isNaN(lat) || Number.isNaN(lon) || !destinationQuery) {
    return res.status(400).json({ error: "lat, lon, and destinationQuery are required." });
  }

  // Check MongoDB cache for non-mock real OSM hotels
  try {
    const cached = await Hotel.find({ destinationQuery, source: { $ne: "mock" } }).limit(30).catch(() => []);
    if (cached.length >= 8) {
      console.log(`[hotels] Returning ${cached.length} real OSM hotels from database cache for "${destinationQuery}"`);
      return res.json({ fromCache: true, hotels: cached });
    }
  } catch (_) {}

  try {
    console.log(`[hotels] Querying real OSM hotels for city "${destinationQuery}"...`);

    // Tier 1: Query by specific city area
    let { elements, endpoint } = await executeOverpassQuery(buildCityAreaOverpassQuery(destinationQuery));
    let source = "overpass_area";

    // Tier 2: If area query yielded few/no results, use coordinate-based around query
    if (elements.length < 5 && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      console.log(`[hotels] Area query returned ${elements.length} hotels, trying 5km coordinate radius...`);
      const aroundResult = await executeOverpassQuery(buildHotelsAroundOverpassQuery(lat, lon, radius));
      if (aroundResult.elements.length > elements.length) {
        elements = aroundResult.elements;
        endpoint = aroundResult.endpoint;
        source = "overpass_around";
      }
    }

    let hotels = [];

    if (elements.length > 0) {
      console.log(`[hotels] Overpass (${endpoint}, ${source}) returned ${elements.length} real OSM elements`);
      const rawHotels = elements
        .filter((el) => el.tags && (el.tags.name || el.tags["name:en"]))
        .map((el, i) => {
          const latitude = el.lat ?? el.center?.lat;
          const longitude = el.lon ?? el.center?.lon;
          const name = el.tags["name:en"] || el.tags.name;
          const details = synthesizeHotelDetails(name, { ...el.tags, osmId: `${el.type}/${el.id}` }, destinationQuery);

          const catInfo = getHotelCategoryAndIcon(el.tags);

          return {
            destinationQuery,
            name,
            address: details.address || `${name}, ${destinationQuery}`,
            lat: latitude,
            lon: longitude,
            pricePerNight: details.pricePerNight,
            currency: "INR",
            rating: details.rating,
            imageUrl: `https://picsum.photos/seed/${encodeURIComponent(name + i)}/400/250`,
            amenities: details.amenities,
            bookingUrl: details.bookingUrl,
            source: "osm_overpass",
            osmId: `${el.type}/${el.id}`,
            icon: catInfo.icon,
            type: catInfo.type,
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

      // Group by accommodation type to distribute evenly
      const byType = {};
      for (const h of uniqueHotels) {
        const t = h.type || "Hotel";
        if (!byType[t]) byType[t] = [];
        byType[t].push(h);
      }
      const balanced = [];
      const types = Object.keys(byType);
      let added = true;
      let idx = 0;
      while (added && balanced.length < 35) {
        added = false;
        for (const t of types) {
          if (idx < byType[t].length) {
            balanced.push(byType[t][idx]);
            added = true;
          }
        }
        idx++;
      }
      hotels = balanced.length > 0 ? balanced : uniqueHotels;
    }

    // Tier 3: If Overpass returned 0 elements, use Nominatim OSM search
    if (hotels.length === 0) {
      console.log(`[hotels] Overpass returned 0 hotels, fetching real OSM hotels via Nominatim...`);
      hotels = await fetchNominatimHotels(destinationQuery, destinationQuery);
    }

    if (hotels.length === 0) {
      throw new Error(`No real OSM hotels found for "${destinationQuery}".`);
    }

    const finalHotels = hotels.slice(0, 30);
    console.log(`[hotels] Successfully resolved ${finalHotels.length} real OSM hotels for "${destinationQuery}"`);

    // Cache real OSM hotels in MongoDB
    try {
      await Hotel.deleteMany({ destinationQuery, source: "mock" }).catch(() => {});
      await Hotel.insertMany(finalHotels, { ordered: false }).catch(() => {});
    } catch (_) {}

    return res.json({ fromCache: false, hotels: finalHotels });
  } catch (err) {
    console.error("[hotels] Error fetching real OSM hotels:", err.message);

    // If completely offline / no internet connection, generate fallback but flag it clearly
    const mockHotels = generateMockHotels(destinationQuery, lat, lon);
    return res.json({ fromCache: false, hotels: mockHotels, mock: true, warning: err.message });
  }
});

export { getHotelCategoryAndIcon };
export default router;
