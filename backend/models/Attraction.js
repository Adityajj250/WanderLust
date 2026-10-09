import mongoose from "mongoose";

/**
 * Tourist attraction near a destination.
 * For the prototype these are seeded from Overpass (OpenStreetMap POI data)
 * or from mock fixtures when Overpass is unavailable, then cached here.
 */
const AttractionSchema = new mongoose.Schema(
  {
    destinationQuery: { type: String, required: true, index: true }, // links back to the searched area
    name: { type: String, required: true },
    category: { type: String, required: true }, // e.g. "Fort & Palace", "Beach", "Museum", "Park", "Viewpoint"
    description: { type: String, default: "" },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    imageUrl: { type: String, default: "" },
    source: { type: String, default: "osm+gemini" },
    osmId: { type: String, index: true },
    osmType: { type: String, default: "node" },
    priority: { type: String, default: "recommended" }, // "must_visit" | "recommended" | "regular"
    curationReason: { type: String, default: "" },
    score: { type: Number, default: 0, index: true },
    wikipedia: { type: String, default: null },
    wikidata: { type: String, default: null },
    icon: { type: String, default: "🏛️" },
  },
  { timestamps: true }
);

export default mongoose.model("Attraction", AttractionSchema);
