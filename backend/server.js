import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { connectDB, clearAllDatabaseData } from "./config/db.js";

import geocodeRoutes from "./routes/geocode.js";
import attractionsRoutes from "./routes/attractions.js";
import hotelsRoutes from "./routes/hotels.js";
import transportRoutes from "./routes/transport.js";
import distanceRoutes from "./routes/distance.js";
import aiRoutes from "./routes/ai.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect to MongoDB and wipe collections on startup
connectDB();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST or DELETE /api/session/reset
 * Clear all cached collections from database when a session ends
 */
const handleSessionReset = async (req, res) => {
  try {
    await clearAllDatabaseData();
    res.json({ success: true, message: "All cached data deleted. Clean slate restored." });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset database session data." });
  }
};

app.post("/api/session/reset", handleSessionReset);
app.delete("/api/session/reset", handleSessionReset);

app.use("/api/geocode", geocodeRoutes);
app.use("/api/attractions", attractionsRoutes);
app.use("/api/hotels", hotelsRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/distance", distanceRoutes);
app.use("/api/ai", aiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  console.log(`[server] WanderLust API running on http://localhost:${PORT}`);
});

// Purge all data when server process shuts down
async function gracefulShutdown(signal) {
  console.log(`\n[server] ${signal} received. Deleting all cached database data...`);
  try {
    await clearAllDatabaseData();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("[server] MongoDB connection closed.");
    }
    server.close(() => {
      console.log("[server] Server closed cleanly.");
      process.exit(0);
    });
  } catch (err) {
    console.error("[server] Error during shutdown cleanup:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
