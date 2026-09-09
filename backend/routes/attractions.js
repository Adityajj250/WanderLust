import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import Attraction from "../models/Attraction.js";
import { generateMockAttractions } from "../utils/mockData.js";

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL;
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL;
const USER_AGENT = process.env.NOMINATIM_USER_AGENT;

// Initialize official GoogleGenAI Client in JavaScript
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});
const MODEL_NAME = "gemini-3.1-flash-lite";

// Comprehensive OSM tags for notable landmarks, heritage sites, and sights
const OVERPASS_TAGS = [
  '["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium"]',
  '["historic"~"monument|memorial|castle|archaeological_site|ruins|fort|palace|city_gate|heritage"]',
  '["heritage"]',
  '["unesco"]',
  '["natural"~"beach|peak|cliff|waterfall|cave_entrance"]',
  '["leisure"~"park|garden|nature_reserve"]',
  '["amenity"="place_of_worship"]["wikipedia"]',
  '["amenity"="place_of_worship"]["tourism"]',
  '["amenity"="place_of_worship"]["historic"]',
  '["amenity"="place_of_worship"]["heritage"]',
  '["amenity"="place_of_worship"]',
];

function buildOverpassQuery(lat, lon, radiusMeters = 20000) {
  const clauses = OVERPASS_TAGS.map((tag) => `nwr${tag}(around:${radiusMeters},${lat},${lon});`).join("\n      ");
  return `
    [out:json][timeout:25];
    (
      ${clauses}
    );
    out tags center 300;
  `;
}

function categoryFromTags(tags = {}) {
  if (tags.historic === "fort" || tags.historic === "castle" || tags.historic === "palace") return "Fort & Palace";
  if (tags.natural === "beach") return "Beach";
  if (tags.natural === "waterfall") return "Waterfall";
  if (tags.tourism === "museum") return "Museum";
  if (tags.tourism === "gallery" || tags.amenity === "arts_centre") return "Art & Culture";
  if (tags.tourism === "viewpoint") return "Viewpoint";
  if (tags.tourism === "theme_park" || tags.tourism === "zoo" || tags.tourism === "aquarium") return "Amusement & Wildlife";
  if (tags.tourism === "attraction" || tags.historic === "monument" || tags.historic === "memorial") return "Monuments & Landmarks";
  if (tags.historic === "archaeological_site" || tags.historic === "ruins" || tags.heritage) return "Heritage & Historic Site";
  if (tags.amenity === "place_of_worship") return "Place of Worship";
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "nature_reserve") return "Park & Nature";
  if (tags.natural === "peak" || tags.natural === "cliff") return "Nature & Scenic Spot";
  return "Point of Interest";
}

function calculatePopularityScore(tags = {}) {
  let score = 0;
  if (tags.wikipedia) score += 30;
  if (tags.wikidata) score += 15;
  if (tags.unesco || tags.heritage || tags["heritage:operator"]) score += 25;
  if (tags.tourism === "attraction") score += 20;
  if (tags.historic === "fort" || tags.historic === "palace" || tags.historic === "castle") score += 18;
  if (tags.natural === "beach" || tags.natural === "waterfall") score += 16;
  if (tags.historic === "monument" || tags.historic === "archaeological_site") score += 14;
  if (tags.tourism === "museum" || tags.tourism === "viewpoint" || tags.tourism === "theme_park") score += 12;
  if (tags.leisure === "nature_reserve" || tags.leisure === "park") score += 8;
  if (tags.amenity === "place_of_worship") {
    score += (tags.historic || tags.wikipedia || tags.tourism) ? 15 : 2;
  }
  if (tags.website || tags["contact:website"]) score += 6;
  if (tags.description) score += 5;
  if (tags["name:en"]) score += 4;
  if (tags.image) score += 4;
  if (tags.stars) score += 4;
  return score;
}

/**
 * Tier 1: Ask Gemini for top 20 curated places for destination
 */
async function fetchGeminiTop20(destinationQuery) {
  const prompt = `You are an expert local travel guide.
List the top 20 most iconic, famous, and must-visit tourist attractions, monuments, viewpoints, beaches, temples, museums, and sights in and around "${destinationQuery}".
Respond ONLY with a valid JSON array of 20 objects with this exact structure:
[
  {
    "name": "Exact Iconic Name (e.g. Sri Krishna Matha)",
    "category": "Place of Worship" | "Beach" | "Heritage & Historic Site" | "Museum" | "Viewpoint" | "Nature & Scenic Spot" | "Park & Nature" | "Monuments & Landmarks",
    "description": "Engaging, concise 1-2 sentence description highlighting why visitors come here."
  }
]`;

  const response = await ai.interactions.create({
    model: MODEL_NAME,
    input: prompt,
  });

  let raw = (response.output_text || "").trim();
  const jsonMatch = raw.match(/```(?:json)?([\s\S]*?)```/);
  if (jsonMatch) raw = jsonMatch[1].trim();

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Gemini did not return a valid array of attractions.");
  }
  return parsed.slice(0, 20);
}

/**
 * Geocode a single place name using OpenStreetMap Nominatim
 */
async function geocodeOsmPlace(placeName, destinationQuery) {
  try {
    const res = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params: {
        q: `${placeName}, ${destinationQuery}`,
        format: "jsonv2",
        limit: 1,
        addressdetails: 0,
      },
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      timeout: 3500,
    });
    const item = res.data?.[0];
    if (item && item.lat && item.lon) {
      return {
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        osmId: `${item.osm_type || "node"}/${item.osm_id || ""}`,
      };
    }
  } catch (_) {}
  return null;
}

/**
 * Helper to normalize string for comparison
 */
function normalizeName(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * GET /api/attractions?lat=..&lon=..&destinationQuery=Udupi
 */
router.get("/", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const destinationQuery = (req.query.destinationQuery || "").trim().toLowerCase();
  const radius = parseInt(req.query.radius || "20000", 10);

  if (Number.isNaN(lat) || Number.isNaN(lon) || !destinationQuery) {
    return res.status(400).json({ error: "lat, lon, and destinationQuery are required." });
  }

  // 1. Cache Check
  try {
    const cached = await Attraction.find({ destinationQuery }).limit(25).catch(() => []);
    if (cached.length >= 10) {
      return res.json({ fromCache: true, attractions: cached });
    }
  } catch (_) {}

  // 2. Fetch Overpass raw POIs in parallel (used for OSM coordinate matching & manual backup)
  let overpassElements = [];
  try {
    const overpassQuery = buildOverpassQuery(lat, lon, radius);
    const opRes = await axios.post(OVERPASS_BASE_URL, overpassQuery, {
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      timeout: 25000,
    });
    overpassElements = opRes.data?.elements || [];
  } catch (err) {
    console.warn("[attractions] Overpass query warning:", err.message);
  }

  // 3. TIER 1: Gemini Curated Top 20 Places + OpenStreetMap Plotting
  try {
    const geminiPlaces = await fetchGeminiTop20(destinationQuery);

    // Map Overpass elements for fast matching
    const overpassLookup = [];
    overpassElements.forEach((el) => {
      const name = el.tags?.["name:en"] || el.tags?.name;
      if (name) {
        const pLat = el.lat ?? el.center?.lat;
        const pLon = el.lon ?? el.center?.lon;
        if (pLat && pLon) {
          overpassLookup.push({
            name,
            norm: normalizeName(name),
            lat: pLat,
            lon: pLon,
            osmId: `${el.type}/${el.id}`,
            wikipedia: el.tags.wikipedia || null,
            image: el.tags.image || null,
          });
        }
      }
    });

    // Geocode and plot each of the 20 Gemini places on OpenStreetMap
    const plottedAttractions = await Promise.all(
      geminiPlaces.map(async (place, idx) => {
        const placeNorm = normalizeName(place.name);

        // A. Match against Overpass OpenStreetMap elements first
        const matchedOp = overpassLookup.find(
          (op) => op.norm.includes(placeNorm) || placeNorm.includes(op.norm)
        );

        let finalLat = matchedOp?.lat;
        let finalLon = matchedOp?.lon;
        let osmId = matchedOp?.osmId;
        let wikipedia = matchedOp?.wikipedia || null;

        // B. If not in Overpass, lookup via OpenStreetMap Nominatim
        if (!finalLat || !finalLon) {
          const nominatimGeocoded = await geocodeOsmPlace(place.name, destinationQuery);
          if (nominatimGeocoded) {
            finalLat = nominatimGeocoded.lat;
            finalLon = nominatimGeocoded.lon;
            osmId = nominatimGeocoded.osmId;
          }
        }

        // C. Safe geographic fallback (offset around city center if geocoding failed)
        if (!finalLat || !finalLon) {
          const angle = (idx / 20) * 2 * Math.PI;
          const distOffset = 0.015 + ((idx * 7) % 20) * 0.0015;
          finalLat = lat + Math.sin(angle) * distOffset;
          finalLon = lon + Math.cos(angle) * distOffset;
          osmId = `gemini-osm/${idx + 1}`;
        }

        return {
          destinationQuery,
          name: place.name,
          category: place.category || "Point of Interest",
          description: place.description || `${place.name} in ${destinationQuery}.`,
          lat: finalLat,
          lon: finalLon,
          imageUrl: matchedOp?.image || `https://picsum.photos/seed/${encodeURIComponent(place.name + idx)}/400/250`,
          source: "gemini_osm",
          osmId: osmId || `osm/${idx + 1}`,
          score: 100 - idx * 3, // Ranked by Gemini popularity
          wikipedia,
        };
      })
    );

    // Save to DB cache
    try {
      await Attraction.insertMany(plottedAttractions, { ordered: false });
    } catch (_) {}

    return res.json({
      fromCache: false,
      attractions: plottedAttractions,
      source: "gemini_osm_top20",
    });
  } catch (geminiErr) {
    console.warn("[attractions] Gemini API failed or unreachable. Activating manual OpenStreetMap backup:", geminiErr.message);
  }

  // 4. TIER 2: MANUAL SYSTEM BACKUP (OpenStreetMap Overpass + Popularity Scoring)
  try {
    if (overpassElements.length > 0) {
      const rawAttractions = overpassElements
        .filter((el) => el.tags && (el.tags.name || el.tags["name:en"]))
        .map((el, i) => {
          const pLat = el.lat ?? el.center?.lat;
          const pLon = el.lon ?? el.center?.lon;
          const name = el.tags["name:en"] || el.tags.name;
          const category = categoryFromTags(el.tags);
          const score = calculatePopularityScore(el.tags);

          return {
            destinationQuery,
            name,
            category,
            description: el.tags.description || `${category} near ${destinationQuery}.`,
            lat: pLat,
            lon: pLon,
            imageUrl: el.tags.image || `https://picsum.photos/seed/${encodeURIComponent(name + i)}/400/250`,
            source: "overpass_backup",
            osmId: `${el.type}/${el.id}`,
            score,
            wikipedia: el.tags.wikipedia || null,
          };
        })
        .filter((a) => a.lat !== undefined && a.lon !== undefined);

      rawAttractions.sort((a, b) => b.score - a.score);

      const seenNames = new Set();
      const uniqueAttractions = [];
      for (const item of rawAttractions) {
        const lower = item.name.toLowerCase();
        if (!seenNames.has(lower)) {
          seenNames.add(lower);
          uniqueAttractions.push(item);
        }
      }

      const attractions = uniqueAttractions.slice(0, 20);

      if (attractions.length > 0) {
        try {
          await Attraction.insertMany(attractions, { ordered: false });
        } catch (_) {}
        return res.json({ fromCache: false, attractions, source: "overpass_manual_backup" });
      }
    }
  } catch (manualErr) {
    console.warn("[attractions] Manual Overpass backup failed:", manualErr.message);
  }

  // 5. TIER 3: OFFLINE MOCK BACKUP
  console.warn("[attractions] Activating offline mock data backup.");
  const mockAttractions = generateMockAttractions(destinationQuery, lat, lon).slice(0, 20);
  try {
    await Attraction.insertMany(mockAttractions, { ordered: false });
  } catch (_) {}

  return res.json({ fromCache: false, attractions: mockAttractions, source: "mock_backup" });
});

export default router;