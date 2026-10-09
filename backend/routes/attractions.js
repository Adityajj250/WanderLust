import express from "express";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import Attraction from "../models/Attraction.js";
import { generateMockAttractions } from "../utils/mockData.js";

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL;
const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || "WanderLust(contact: adityapoddar250@gmail.com)";

const OVERPASS_ENDPOINTS = [
  OVERPASS_BASE_URL,
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
].filter(Boolean);

// Initialize official GoogleGenAI Client in JavaScript
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});
const MODEL_NAME = "gemini-3.1-flash-lite";

// Comprehensive OSM tags for notable landmarks, heritage sites, and sights
const OVERPASS_TAGS = [
  '["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo"]',
  '["historic"~"monument|memorial|castle|archaeological_site|ruins|fort|palace"]',
  '["heritage"]',
  '["unesco"]',
  '["natural"~"beach|peak|cliff|waterfall"]',
  '["waterway"="waterfall"]',
  '["leisure"~"park|nature_reserve|stadium|swimming_area"]',
  '["amenity"="theatre"]',
  '["amenity"="place_of_worship"]',
  '["amenity"="restaurant"]["wikipedia"]',
  '["amenity"="cafe"]["wikipedia"]',
  '["amenity"="fast_food"]["wikipedia"]',
  '["shop"="mall"]',
  '["amenity"="marketplace"]',
];

function buildOverpassQuery(lat, lon, radiusMeters = 5000) {
  const clauses = OVERPASS_TAGS.map((tag) => `nwr${tag}(around:${radiusMeters},${lat},${lon});`).join("\n      ");
  return `
    [out:json][timeout:25];
    (
      ${clauses}
    );
    out tags center 300;
  `;
}

function categoryAndIconFromTags(tags = {}) {
  // 1. Places of Worship / Temples
  if (tags.amenity === "place_of_worship") {
    if (tags.religion === "hindu") return { category: "Hindu Temple", icon: "🛕", group: "temples" };
    if (tags.religion === "muslim") return { category: "Mosque", icon: "🕌", group: "temples" };
    if (tags.religion === "christian") return { category: "Church", icon: "⛪", group: "temples" };
    return { category: "Place of Worship", icon: "🛐", group: "temples" };
  }

  // 2. Beaches & Water
  if (tags.natural === "beach") return { category: "Beach", icon: "🏖️", group: "beaches" };
  if (tags.leisure === "swimming_area") return { category: "Swimming Area", icon: "🏊", group: "beaches" };

  // 3. Museums & Culture
  if (tags.tourism === "museum") return { category: "Museum", icon: "🏛️", group: "museums" };
  if (tags.tourism === "gallery") return { category: "Gallery", icon: "🎨", group: "museums" };
  if (tags.amenity === "theatre") return { category: "Theatre", icon: "🎭", group: "museums" };

  // 4. Monuments & Attractions
  if (tags.historic === "monument" || tags.historic === "memorial") return { category: "Monument", icon: "🗿", group: "monuments" };
  if (tags.tourism === "theme_park") return { category: "Theme Park", icon: "🎢", group: "monuments" };
  if (tags.leisure === "stadium") return { category: "Stadium", icon: "🏟️", group: "monuments" };
  if (tags.tourism === "attraction") return { category: "Tourist Attraction", icon: "🏞️", group: "monuments" };

  // 5. Heritage & Historic Sites
  if (tags.historic === "castle" || tags.historic === "fort" || tags.historic === "palace") return { category: "Castle & Fort", icon: "🏰", group: "heritage" };
  if (tags.historic === "ruins") return { category: "Ruins", icon: "🏚️", group: "heritage" };
  if (tags.historic === "archaeological_site") return { category: "Archaeological Site", icon: "🗿", group: "heritage" };
  if (tags.heritage || tags.unesco) return { category: "Heritage Site", icon: "🏰", group: "heritage" };

  // 6. Nature & Views
  if (tags.tourism === "viewpoint") return { category: "Viewpoint", icon: "🌅", group: "nature" };
  if (tags.waterway === "waterfall" || tags.natural === "waterfall") return { category: "Waterfall", icon: "🌊", group: "nature" };
  if (tags.tourism === "zoo" || tags.tourism === "aquarium") return { category: "Zoo & Wildlife", icon: "🦁", group: "nature" };
  if (tags.leisure === "nature_reserve") return { category: "Nature Reserve", icon: "🌲", group: "nature" };
  if (tags.leisure === "park" || tags.leisure === "garden") return { category: "Park & Garden", icon: "🌳", group: "nature" };
  if (tags.natural === "peak" || tags.natural === "cliff") return { category: "Scenic Spot", icon: "🏞️", group: "nature" };

  // 7. Dining & Shopping
  if (tags.amenity === "restaurant") return { category: "Restaurant", icon: "🍽️", group: "dining" };
  if (tags.amenity === "cafe") return { category: "Cafe", icon: "☕", group: "dining" };
  if (tags.amenity === "fast_food") return { category: "Fast Food", icon: "🍔", group: "dining" };
  if (tags.shop === "mall" || tags.amenity === "marketplace") return { category: "Market & Mall", icon: "🛍️", group: "shopping" };
  if (tags.shop) return { category: "Shopping", icon: "🛒", group: "shopping" };

  return { category: "Point of Interest", icon: "📍", group: "monuments" };
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

function normalizeName(str = "") {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Gemini Curation Engine:
 * Gemini receives real OSM candidate objects (with OSM IDs and categories) and selects
 * the most iconic and culturally significant Hot Picks strictly by OSM ID.
 */
async function curateWithGemini(candidates, destinationQuery, { days = 3, travellers = 1, interests = "" } = {}) {
  const candidatePayload = candidates.map((c) => ({
    osm_id: c.osmId,
    name: c.name,
    category: c.category,
    has_wikipedia: Boolean(c.wikipedia),
    has_wikidata: Boolean(c.wikidata),
    description: c.description || undefined,
  }));

  const prompt = `You are the destination curation engine for WanderLust.
You are given a list of real places retrieved from OpenStreetMap for "${destinationQuery}".
Trip context: Duration ${days} day(s), ${travellers} traveller(s)${interests ? `, Interests: ${interests}` : ""}.

Select approximately 20 to 25 places that would be most valuable, iconic, and culturally enriching to show to a traveller visiting this destination.

Prioritize:
1. Iconic landmarks strongly associated with ${destinationQuery}
2. Major cultural attractions and world-famous sites
3. Historically significant monuments, palaces, and heritage locations
4. Scenic viewpoints, natural wonders, and beaches
5. Highly rated visitor experiences
6. Good diversity across attraction categories

IMPORTANT RULES:
- Only select places from the supplied candidate list below.
- Never invent a place.
- Never create a new OSM ID.
- Never return an OSM ID that was not supplied in the candidates.
- Do not invent coordinates. The supplied OSM entities are the sole source of truth.
- Return the OSM IDs of the selected places in clean JSON.

Candidate OSM Places:
${JSON.stringify(candidatePayload, null, 2)}

Respond ONLY with this exact JSON structure:
{
  "hot_picks": [
    {
      "osm_id": "Exact OSM ID from candidates",
      "priority": "must_visit" | "recommended",
      "reason": "1 concise sentence why travellers should visit this place in ${destinationQuery}."
    }
  ]
}`;

  const response = await ai.interactions.create({
    model: MODEL_NAME,
    input: prompt,
  });

  let raw = (response.output_text || "").trim();
  const jsonMatch = raw.match(/```(?:json)?([\s\S]*?)```/);
  if (jsonMatch) raw = jsonMatch[1].trim();

  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.hot_picks) || parsed.hot_picks.length === 0) {
    throw new Error("Gemini did not return valid hot_picks array.");
  }

  return parsed.hot_picks;
}

/**
 * DELETE /api/attractions/cache
 * Development-only endpoint to clear old/stale attraction records.
 */
router.delete("/cache", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Cache clearing is disabled in production." });
  }
  try {
    const result = await Attraction.deleteMany({});
    console.log(`[attractions] Cache cleared: ${result.deletedCount} records deleted.`);
    return res.json({ deleted: result.deletedCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/attractions?lat=..&lon=..&destinationQuery=Paris
 */
router.get("/", async (req, res) => {
  // Prevent browser & proxy caching
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const destinationQuery = (req.query.destinationQuery || "").trim().toLowerCase();
  const radius = parseInt(req.query.radius || "5000", 10);
  const days = parseInt(req.query.days || "3", 10);
  const travellers = parseInt(req.query.travellers || "1", 10);
  const interests = (req.query.interests || "").trim();

  if (Number.isNaN(lat) || Number.isNaN(lon) || !destinationQuery) {
    return res.status(400).json({ error: "lat, lon, and destinationQuery are required." });
  }

  console.log(`[attractions] Destination: "${destinationQuery}"`);
  console.log(`[attractions] Coordinates: ${lat}, ${lon}`);

  // 1. Overpass Candidate Discovery with mirror failover
  let overpassElements = [];
  const overpassQuery = buildOverpassQuery(lat, lon, radius);

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const opRes = await axios.post(endpoint, overpassQuery, {
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        timeout: 18000,
      });
      if (opRes.data?.elements && opRes.data.elements.length > 0) {
        overpassElements = opRes.data.elements;
        console.log(`[attractions] Overpass fetched ${overpassElements.length} elements via ${endpoint}`);
        break;
      }
    } catch (err) {
      console.warn(`[attractions] Overpass mirror (${endpoint}) warning: ${err.message}`);
    }
  }

  // 2. Nominatim fallback if Overpass mirrors failed or returned 0
  if (overpassElements.length === 0) {
    try {
      console.log(`[attractions] Attempting Nominatim OSM discovery for "${destinationQuery}"...`);
      const nomUrl = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent("attractions in " + destinationQuery)}&format=json&limit=35&addressdetails=1`;
      const nomRes = await axios.get(nomUrl, {
        headers: { "User-Agent": USER_AGENT },
        timeout: 10000,
      });
      if (Array.isArray(nomRes.data) && nomRes.data.length > 0) {
        console.log(`[attractions] Nominatim returned ${nomRes.data.length} real OSM attractions.`);
        for (const item of nomRes.data) {
          overpassElements.push({
            type: item.osm_type || "node",
            id: item.osm_id,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            tags: {
              name: item.name || item.display_name?.split(",")[0],
              tourism: item.type === "museum" ? "museum" : "attraction",
              importance: item.importance,
            },
          });
        }
      }
    } catch (nomErr) {
      console.warn(`[attractions] Nominatim discovery warning: ${nomErr.message}`);
    }
  }

  // 3. Normalize & Deduplicate Overpass Candidates
  const normalizedCandidates = [];
  if (overpassElements.length > 0) {
    const seenNames = new Set();
    const seenOsmIds = new Set();

    for (const el of overpassElements) {
      const pLat = el.lat ?? el.center?.lat;
      const pLon = el.lon ?? el.center?.lon;
      const name = el.tags?.["name:en"] || el.tags?.name;

      // Filter out elements without valid names or coordinates
      if (!name || pLat === undefined || pLon === undefined) continue;

      const osmId = `${el.type}/${el.id}`;
      if (seenOsmIds.has(osmId)) continue;
      seenOsmIds.add(osmId);

      const norm = normalizeName(name);
      if (seenNames.has(norm)) continue;
      seenNames.add(norm);

      const catInfo = categoryAndIconFromTags(el.tags);
      const preScore = calculatePopularityScore(el.tags);

      normalizedCandidates.push({
        osmId,
        osmType: el.type,
        name,
        category: catInfo.category,
        icon: catInfo.icon,
        group: catInfo.group,
        lat: pLat,
        lon: pLon,
        preScore,
        wikidata: el.tags.wikidata || null,
        wikipedia: el.tags.wikipedia || null,
        description: el.tags.description || null,
        imageUrl: el.tags.image || null,
        tags: el.tags,
      });
    }
  }

  console.log(`[attractions] Overpass elements: ${overpassElements.length}`);
  console.log(`[attractions] Normalized candidates: ${normalizedCandidates.length}`);

  // 4. Pre-filter candidate universe with stratified distribution across categories
  const grouped = {};
  for (const c of normalizedCandidates) {
    const g = c.group || "monuments";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(c);
  }
  for (const g of Object.keys(grouped)) {
    grouped[g].sort((a, b) => b.preScore - a.preScore);
  }

  const evenlyDistributed = [];
  const groups = ["temples", "beaches", "museums", "monuments", "heritage", "nature", "dining", "shopping"];
  let round = 0;
  let hasMore = true;
  while (hasMore && evenlyDistributed.length < 120) {
    hasMore = false;
    for (const g of groups) {
      if (grouped[g] && round < grouped[g].length) {
        evenlyDistributed.push(grouped[g][round]);
        hasMore = true;
      }
    }
    round++;
  }
  const candidatePool = evenlyDistributed.length > 0 ? evenlyDistributed : normalizedCandidates.slice(0, 120);
  console.log(`[attractions] Stratified candidate pool: ${candidatePool.length}`);
  const hasEiffel = candidatePool.some((c) => c.name.toLowerCase().includes("eiffel"));
  if (destinationQuery.includes("paris")) {
    console.log(`[attractions] Contains 'Eiffel' in candidate pool: ${hasEiffel}`);
  }

  // 5. Gemini Curation (Selecting from real OSM candidate pool by OSM ID)
  if (candidatePool.length > 0) {
    try {
      console.log(`[attractions] Calling Gemini for curation...`);
      const hotPicks = await curateWithGemini(candidatePool, destinationQuery, {
        days,
        travellers,
        interests,
      });
      console.log(`[attractions] Gemini selected: ${hotPicks.length}`);

      // Map Gemini selections back to physical OSM objects
      const candidateMap = new Map(candidatePool.map((c) => [c.osmId, c]));
      const curatedAttractions = [];
      const usedIds = new Set();

      hotPicks.forEach((pick, idx) => {
        const candidate = candidateMap.get(pick.osm_id);
        if (candidate && !usedIds.has(candidate.osmId)) {
          usedIds.add(candidate.osmId);
          const isMustVisit = pick.priority === "must_visit";

          curatedAttractions.push({
            destinationQuery,
            name: candidate.name,
            category: candidate.category,
            icon: candidate.icon || "🏛️",
            group: candidate.group || "monuments",
            description: candidate.description || `${candidate.category} in ${destinationQuery}.`,
            lat: candidate.lat,
            lon: candidate.lon,
            imageUrl: candidate.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(candidate.name + idx)}/400/250`,
            source: "osm+gemini",
            osmId: candidate.osmId,
            osmType: candidate.osmType,
            priority: isMustVisit ? "must_visit" : "recommended",
            curationReason: pick.reason || `Iconic ${candidate.category} in ${destinationQuery}.`,
            score: isMustVisit ? 98 - idx * 2 : 75 - idx * 2,
            wikipedia: candidate.wikipedia,
            wikidata: candidate.wikidata,
          });
        }
      });

      // Ensure at least 15 sights; if Gemini selected fewer, supplement with top pre-scored candidates
      if (curatedAttractions.length < 15) {
        for (const candidate of candidatePool) {
          if (!usedIds.has(candidate.osmId) && curatedAttractions.length < 25) {
            usedIds.add(candidate.osmId);
            curatedAttractions.push({
              destinationQuery,
              name: candidate.name,
              category: candidate.category,
              icon: candidate.icon || "🏛️",
              group: candidate.group || "monuments",
              description: candidate.description || `${candidate.category} in ${destinationQuery}.`,
              lat: candidate.lat,
              lon: candidate.lon,
              imageUrl: candidate.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(candidate.name + curatedAttractions.length)}/400/250`,
              source: "osm+gemini",
              osmId: candidate.osmId,
              osmType: candidate.osmType,
              priority: "recommended",
              curationReason: `Notable ${candidate.category} discovered in ${destinationQuery}.`,
              score: 65 - curatedAttractions.length,
              wikipedia: candidate.wikipedia,
              wikidata: candidate.wikidata,
            });
          }
        }
      }

      console.log(`[attractions] Final curated attractions: ${curatedAttractions.length}`);

      if (curatedAttractions.length > 0) {
        return res.json({
          fromCache: false,
          attractions: curatedAttractions,
          source: "osm+gemini",
        });
      }
    } catch (geminiErr) {
      console.warn("[attractions] Gemini curation failed, falling back to OSM heuristic ranking:", geminiErr.message);
    }
  }

  // 6. Fallback Tier 1: OSM Heuristic Ranking (Real OSM candidates)
  if (candidatePool.length > 0) {
    console.log(`[attractions] Serving from Tier 1 OSM Heuristic (count: ${Math.min(25, candidatePool.length)})`);
    const heuristicAttractions = candidatePool.slice(0, 25).map((candidate, idx) => ({
      destinationQuery,
      name: candidate.name,
      category: candidate.category,
      icon: candidate.icon || "🏛️",
      group: candidate.group || "monuments",
      description: candidate.description || `${candidate.category} near ${destinationQuery}.`,
      lat: candidate.lat,
      lon: candidate.lon,
      imageUrl: candidate.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(candidate.name + idx)}/400/250`,
      source: "osm_heuristic",
      osmId: candidate.osmId,
      osmType: candidate.osmType,
      priority: idx < 8 ? "must_visit" : "recommended",
      curationReason: `Ranked by cultural & historical prominence in ${destinationQuery}.`,
      score: 90 - idx * 2,
      wikipedia: candidate.wikipedia,
      wikidata: candidate.wikidata,
    }));

    return res.json({
      fromCache: false,
      attractions: heuristicAttractions,
      source: "osm_heuristic",
    });
  }

  // 7. Fallback Tier 2: Offline Mock Backup (Explicitly marked)
  console.warn("[attractions] Activating offline mock data backup.");
  const mockAttractions = generateMockAttractions(destinationQuery, lat, lon).slice(0, 20).map((m) => ({
    ...m,
    source: "mock_demo",
    priority: "recommended",
    curationReason: `Sample sightseeing attraction in ${destinationQuery}.`,
  }));

  return res.json({ fromCache: false, attractions: mockAttractions, source: "mock_demo" });
});

export { categoryAndIconFromTags };
export default router;