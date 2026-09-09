import mongoose from "mongoose";

/**
 * A destination is a cached geocoding result for an area the user searched for.
 * Caching means repeat searches for "Udupi" don't re-hit Nominatim every time.
 */
const DestinationSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, index: true }, // raw user search text
    displayName: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    boundingBox: { type: [Number], default: undefined }, // [south, north, west, east]
    placeId: { type: String },
    osmType: { type: String },
    osmId: { type: String },
    raw: { type: mongoose.Schema.Types.Mixed }, // full Nominatim payload, for future use
  },
  { timestamps: true }
);

DestinationSchema.index({ query: 1 }, { unique: false });

export default mongoose.model("Destination", DestinationSchema);
