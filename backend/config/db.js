import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/travel_planner";
  try {
    await mongoose.connect(uri);
    console.log("[db] MongoDB connected:", uri);
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    console.error("[db] The API will still run, but caching/persistence endpoints will fail until MongoDB is available.");
  }
}
