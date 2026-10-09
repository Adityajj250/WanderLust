import mongoose from "mongoose";
import Destination from "../models/Destination.js";
import Attraction from "../models/Attraction.js";
import Hotel from "../models/Hotel.js";
import TransportHub from "../models/TransportHub.js";

export async function clearAllDatabaseData() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const results = await Promise.all([
      Destination.deleteMany({}),
      Attraction.deleteMany({}),
      Hotel.deleteMany({}),
      TransportHub.deleteMany({}),
    ]);
    console.log("[db] All cached collections wiped clean. Fresh start ready.");
    return results;
  } catch (err) {
    console.warn("[db] Error while wiping database collections:", err.message);
  }
}

export async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/travel_planner";
  try {
    await mongoose.connect(uri);
    console.log("[db] MongoDB connected:", uri);
    // Wipe all cached data on server start so everything starts from scratch
    await clearAllDatabaseData();
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    console.error("[db] The API will still run, but caching/persistence endpoints will fail until MongoDB is available.");
  }
}
