import mongoose from "mongoose";

/**
 * Hotel near a destination. Prototype uses mock pricing/rating/booking data,
 * structured so a real hotel-inventory API can populate the same fields later.
 */
const HotelSchema = new mongoose.Schema(
  {
    destinationQuery: { type: String, required: true, index: true },
    name: { type: String, required: true },
    address: { type: String, default: "" },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    pricePerNight: { type: Number, required: true }, // in INR for prototype
    currency: { type: String, default: "INR" },
    rating: { type: Number, min: 0, max: 5, default: 4 },
    imageUrl: { type: String, default: "" },
    amenities: { type: [String], default: [] },
    bookingUrl: { type: String, default: "" }, // placeholder / mock booking link
    source: { type: String, default: "osm" },
    osmId: { type: String },
    icon: { type: String, default: "🏨" },
    type: { type: String, default: "Hotel" },
  },
  { timestamps: true }
);

export default mongoose.model("Hotel", HotelSchema);
