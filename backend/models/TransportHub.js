import mongoose from "mongoose";

/**
 * Transportation hub near a destination (Airport, Railway Station, Bus Station, Bus Stop).
 * Seeded from Overpass (OpenStreetMap) or mock fixtures when Overpass is unavailable.
 */
const TransportHubSchema = new mongoose.Schema(
  {
    destinationQuery: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["Airport", "Railway Station", "Bus Station", "Bus Stop"],
    },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    operator: { type: String, default: "" },
    network: { type: String, default: "" },
    source: { type: String, enum: ["overpass", "mock"], default: "mock" },
    osmId: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("TransportHub", TransportHubSchema);
