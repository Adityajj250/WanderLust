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
    source: { type: String, enum: ["overpass", "mock"], default: "mock" },
    osmId: { type: String },
    score: { type: Number, default: 0, index: true }, // popularity score: higher = more famous/popular
    wikipedia: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Attraction", AttractionSchema);
