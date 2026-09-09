import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";

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

// Connect to MongoDB (non-blocking — server still starts if this fails,
// external geocoding/mock endpoints keep working, only caching is degraded).
connectDB();

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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

app.listen(PORT, () => {
  console.log(`[server] WanderLust API running on http://localhost:${PORT}`);
});
