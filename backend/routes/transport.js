import express from "express";
import axios from "axios";
import TransportHub from "../models/TransportHub.js";
import { generateMockTransportHubs } from "../utils/mockData.js";

const router = express.Router();
const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL || "https://overpass-api.de/api/interpreter";

function buildTransportOverpassQuery(lat, lon) {
  // Airports and major railway stations often sit slightly further outside urban centers.
  return `
    [out:json][timeout:25];
    (
      nwr["aeroway"~"aerodrome|terminal"](around:35000,${lat},${lon});
      nwr["railway"~"station|halt"](around:20000,${lat},${lon});
      nwr["amenity"="bus_station"](around:15000,${lat},${lon});
      nwr["public_transport"="station"](around:15000,${lat},${lon});
      nwr["highway"="bus_stop"]["name"](around:8000,${lat},${lon});
    );
    out tags center 80;
  `;
}

function getHubType(tags = {}) {
  if (tags.aeroway === "aerodrome" || tags.aeroway === "terminal") return "Airport";
  if (tags.railway === "station" || tags.railway === "halt") return "Railway Station";
  if (tags.amenity === "bus_station" || (tags.public_transport === "station" && tags.bus === "yes")) {
    return "Bus Station";
  }
  if (tags.highway === "bus_stop" || tags.public_transport === "stop_position") return "Bus Stop";
  if (tags.public_transport === "station") return "Bus Station";
  return "Bus Stop";
}

const TYPE_PRIORITY = {
  Airport: 1,
  "Railway Station": 2,
  "Bus Station": 3,
  "Bus Stop": 4,
};

/**
 * GET /api/transport?lat=..&lon=..&destinationQuery=Udupi
 */
router.get("/", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const destinationQuery = (req.query.destinationQuery || "").trim().toLowerCase();

  if (Number.isNaN(lat) || Number.isNaN(lon) || !destinationQuery) {
    return res.status(400).json({ error: "lat, lon, and destinationQuery are required." });
  }

  // Cache lookup
  try {
    const cached = await TransportHub.find({ destinationQuery }).limit(40).catch(() => []);
    if (cached.length) {
      return res.json({ fromCache: true, transportHubs: cached });
    }
  } catch (_) {}

  try {
    const query = buildTransportOverpassQuery(lat, lon);
    const response = await axios.post(OVERPASS_BASE_URL, query, {
      headers: {
        "Content-Type": "text/plain",
        "User-Agent": process.env.NOMINATIM_USER_AGENT || "WanderLust/1.0",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    const elements = response.data?.elements || [];

    const rawHubs = elements
      .filter((el) => el.tags && (el.tags.name || el.tags["name:en"]))
      .map((el) => {
        const latitude = el.lat ?? el.center?.lat;
        const longitude = el.lon ?? el.center?.lon;
        const name = el.tags["name:en"] || el.tags.name;
        const type = getHubType(el.tags);

        return {
          destinationQuery,
          name,
          type,
          lat: latitude,
          lon: longitude,
          operator: el.tags.operator || el.tags.network || "",
          source: "overpass",
          osmId: `${el.type}/${el.id}`,
        };
      })
      .filter((h) => h.lat !== undefined && h.lon !== undefined);

    // Deduplicate identical or very similar names
    const seen = new Set();
    const uniqueHubs = [];

    // Sort by type importance (Airports first, then Railway Stations, Bus Stations, Bus Stops)
    rawHubs.sort((a, b) => (TYPE_PRIORITY[a.type] || 5) - (TYPE_PRIORITY[b.type] || 5));

    for (const hub of rawHubs) {
      const key = `${hub.type}:${hub.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueHubs.push(hub);
      }
    }

    const transportHubs = uniqueHubs.slice(0, 30);

    if (!transportHubs.length) throw new Error("No named transport hubs returned by Overpass.");

    try {
      await TransportHub.insertMany(transportHubs, { ordered: false });
    } catch (_) {}

    res.json({ fromCache: false, transportHubs });
  } catch (err) {
    console.warn("[transport] Overpass failed, using mock data:", err.message);
    const mockHubs = generateMockTransportHubs(destinationQuery, lat, lon);
    try {
      await TransportHub.insertMany(mockHubs, { ordered: false });
    } catch (_) {}
    res.json({ fromCache: false, transportHubs: mockHubs, mock: true });
  }
});

export default router;
