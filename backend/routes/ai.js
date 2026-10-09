import express from "express";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required.");
}

// Initialize GoogleGenAI SDK in JavaScript
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// Primary model (override with GEMINI_MODEL in .env). If it is rejected we
// automatically fall back to the next model in the list.
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const MODEL_CANDIDATES = [...new Set([MODEL_NAME, "gemini-2.5-flash", "gemini-2.5-flash-lite"])];

// Uses the stable generateContent API, trying each candidate model in turn.
async function generateText(contents, systemInstruction) {
  let lastErr;
  for (const model of MODEL_CANDIDATES) {
    try {
      const config = systemInstruction ? { systemInstruction } : undefined;
      const response = await ai.models.generateContent({
        model,
        contents,
        ...(config ? { config } : {}),
      });
      const text = response.text;
      if (!text) throw new Error("No text output received from model.");
      return { text, model };
    } catch (err) {
      lastErr = err;
      console.error(`[ai] ${model} failed:`, err?.status || "", err?.message || err);
      // Auth / quota problems won't be fixed by another model
      if ([401, 403, 429].includes(err?.status)) break;
    }
  }
  throw lastErr;
}

// Turn the SDK's raw error into a readable message
function friendlyError(err) {
  let msg = err?.message || "Failed to generate AI trip plan.";
  try {
    const parsed = JSON.parse(msg);
    msg = parsed?.error?.message || msg;
  } catch (_) {}
  if (err?.status === 401 || err?.status === 403 || /API key/i.test(msg)) {
    return "Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env.";
  }
  if (err?.status === 429) return "Gemini quota/rate limit reached. Please try again in a minute.";
  return msg;
}

/**
 * POST /api/ai/plan-trip
 * Non-streaming itinerary generation (generateContent API)
 */
router.post("/plan-trip", async (req, res) => {
  const { destination, days = 3, interests = "sightseeing & culture", budget = "moderate" } = req.body || {};

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return res.status(400).json({ error: "Destination name is required." });
  }

  const prompt = `
You are an expert travel guide and itinerary planner.
Create a comprehensive, inspiring, and realistic day-by-day travel itinerary for a trip to "${destination.trim()}".

Trip Details:
- Duration: ${days} day(s)
- Travel Style / Interests: ${interests}
- Budget: ${budget}

Format your response in clean, organized Markdown:
# 🗺️ ${days}-Day Itinerary for ${destination.trim()}

## 🌟 Trip Highlights & Summary
A brief 2-sentence captivating summary of what makes this trip special.

## 🗓️ Day-by-Day Schedule
For each day:
### Day X: [Theme of the day]
- **🌅 Morning (9:00 AM - 1:00 PM):** Key monuments or historic sights to visit with tips.
- **☀️ Afternoon (1:00 PM - 5:00 PM):** Cultural sights, museum, beach, or nature activity.
- **🌙 Evening (5:00 PM onwards):** Scenic sunset point, evening market, and local dinner.

## 🏨 Where to Stay
Recommended areas/neighborhoods and accommodation styles.

## 🚕 Transportation Advice
Best ways to arrive and get around (taxis, auto-rickshaws, public transport).

## 🍽️ Must-Try Local Cuisine
Top authentic dishes to try during the stay.

## 💡 Practical Travel Tips
Best season, local customs, and smart budgeting advice.

## 📌 Recommended Places Checklist
Provide an exact JSON block listing 4 to 8 key attractions or landmarks mentioned above:
\`\`\`json
{
  "recommendedPlaces": ["Place 1", "Place 2", "Place 3", "Place 4"]
}
\`\`\`
`;

  try {
    const { text: rawText, model: usedModel } = await generateText(prompt);

    let recommendedPlaces = [];
    let cleanItinerary = rawText;

    // Extract recommended places JSON block if present
    const jsonMatch = rawText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed.recommendedPlaces)) {
          recommendedPlaces = parsed.recommendedPlaces;
        }
      } catch (_) {}
    }

    // Clean out the raw JSON block from displayed itinerary
    cleanItinerary = cleanItinerary.replace(/## 📌 Recommended Places Checklist[\s\S]*?```json[\s\S]*?```/g, "").trim();

    res.json({
      success: true,
      destination: destination.trim(),
      days,
      itinerary: cleanItinerary,
      recommendedPlaces,
      model: usedModel,
    });
  } catch (err) {
    console.error(`[ai/plan-trip] Error:`, err.message || err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

/**
 * POST /api/ai/plan-trip-stream
 * Streaming response using Server-Sent Events (SSE)
 */
router.post("/plan-trip-stream", async (req, res) => {
  const { destination, days = 3, interests = "sightseeing & culture", budget = "moderate" } = req.body || {};

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return res.status(400).json({ error: "Destination name is required." });
  }

  const prompt = `Create a ${days}-day travel itinerary for "${destination.trim()}". Interests: ${interests}. Budget: ${budget}.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await ai.models.generateContentStream({ model: MODEL_NAME, contents: prompt });

    for await (const chunk of stream) {
      if (chunk.text) res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error(`[ai/plan-trip-stream] Error streaming ${MODEL_NAME}:`, err.message || err);
    res.write(`data: ${JSON.stringify({ error: friendlyError(err) })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/ai/sunshine/home-chat
 * Sunshine Vibe-Finder Chatbot on the Home Page (Cool Dude Personality)
 */
router.post("/sunshine/home-chat", async (req, res) => {
  const { messages = [] } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  const systemInstruction = `You are Sunshine, the chillest, friendliest, and most enthusiastic travel guru and "cool dude" buddy!
Your tone is laid-back, upbeat, positive, and fun (use natural casual expressions like "Yo!", "Bro", "My friend", "Stoked", "Vibe", "Say less", "100%", but always friendly, tasteful, and helpful).
Your ONLY mission on the Home Page is to find out the user's travel mood/vibe and recommend 3 to 4 awesome destinations that match their vibe.
Ask what their vibe is: are they craving sunny beaches, snowy mountain peaks, peaceful spiritual escapes, wild nightlife, food trails, or offbeat nature?
When they tell you what they like, vibe with them enthusiastically and give them 3-4 curated destination recommendations with a catchy 1-2 sentence reason for each.

Format each recommended destination with a clickable tag like:
[Destination: Goa] or [Destination: Manali] or [Destination: Jaipur] or [Destination: Udupi]
For example:
- **Goa** [Destination: Goa] — Sun, waves, beach shacks, and electric sunset energy.
- **Manali** [Destination: Manali] — Crisp Himalayan air, pine forests, and cozy mountain cafes.

Keep responses concise, vibrant, punchy, and easy to read.`;

  const contents = messages.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));

  try {
    const { text, model } = await generateText(contents, systemInstruction);

    // Extract any destination tags [Destination: Name]
    const destMatches = [...text.matchAll(/\[Destination:\s*([^\]]+)\]/gi)].map((m) => m[1].trim());
    const uniqueDestinations = [...new Set(destMatches)];

    res.json({
      success: true,
      text,
      suggestedDestinations: uniqueDestinations,
      model,
    });
  } catch (err) {
    console.error("[ai/sunshine/home-chat] Error:", err.message || err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

/**
 * POST /api/ai/sunshine/workspace-chat
 * Sunshine Screen-Aware Assistant on Destination Workspace & Trip Planner
 */
router.post("/sunshine/workspace-chat", async (req, res) => {
  const { messages = [], screenContext = {} } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  const {
    destination = "Unknown Destination",
    weather = null,
    attractions = [],
    hotels = [],
    transportHubs = [],
    trip = {},
  } = screenContext;

  // Format compact summaries of real OSM items on screen
  const attractionsList = attractions.slice(0, 30).map((a) => {
    return `- ${a.name} (${a.category || "Sight"}${a.priority ? `, priority: ${a.priority}` : ""})`;
  }).join("\n");

  const hotelsList = hotels.slice(0, 15).map((h) => {
    return `- ${h.name} (${h.type || "Hotel"}, ₹${h.pricePerNight || 3000}/night, rating: ${h.rating || 4.2})`;
  }).join("\n");

  const transportList = transportHubs.slice(0, 10).map((t) => {
    return `- ${t.name} (${t.type || "Hub"})`;
  }).join("\n");

  const weatherSummary = weather
    ? `${weather.temp ?? weather.temperature ?? "Unknown"}°C, ${weather.condition || weather.description || "clear"}${weather.summary ? ` (${weather.summary})` : ""}`
    : "Live weather data not loaded yet.";

  const tripSummary = `Duration: ${trip.durationDays || 3} days, Travellers: ${trip.travellers || 1}, Selected Sights: ${(trip.selectedAttractions || []).map((a) => a.name).join(", ") || "None yet"}, Selected Hotel: ${trip.selectedHotel?.name || "None yet"}, Arrival Hub: ${trip.arrivalHub?.name || "None yet"}.`;

  const latestUserMessage = messages[messages.length - 1]?.content || "";
  const isPlanRequest = /plan\s+for\s+me/i.test(latestUserMessage);

  const systemInstruction = `You are Sunshine, the ultimate travel guide and cool dude assistant for WanderLust.
You have FULL AWARENESS of everything currently on the user's screen for this destination!

CURRENT SCREEN CONTEXT:
📍 Destination: ${destination}
🌡️ Live Weather & Temp: ${weatherSummary}

🏛️ REAL PLACES & ATTRACTIONS ON SCREEN (fetched from OpenStreetMap):
${attractionsList || "None fetched"}

🏨 REAL HOTELS ON SCREEN (fetched from OpenStreetMap):
${hotelsList || "None fetched"}

🚆 TRANSIT HUBS ON SCREEN (fetched from OpenStreetMap):
${transportList || "None fetched"}

🧭 CURRENT TRIP STATE:
${tripSummary}

YOUR BEHAVIOR & RULES:
1. Maintain your friendly, upbeat "cool dude" personality (use natural warm slang like "Yo!", "Bro", "I got you!", "Say less", "Awesome vibes").
2. Answer any question about the destination, live temperature/weather, packing advice, hotel comparisons, or how to get from transit hubs to hotels.
3. CRITICAL MANDATORY RULE: When discussing, recommending, or scheduling attractions and places, you MUST ONLY USE PLACES FROM THE REAL OPENSTREETMAP LIST ABOVE! Do not invent, hallucinate, or name any attractions outside this list.
4. CODE WORD "Plan for me":
   - In casual conversation, remind the user of the magic code word: "Whenever you want a full day-by-day plan, just say: **Plan for me**!"
   - If the user's latest query mentions the code word "Plan for me" (or asks to build a complete itinerary/plan):
     - Take into account ALL likes, dislikes, preferences, and style mentioned during the conversation.
     - Strictly use the places from the OpenStreetMap list above to build an inspiring, realistic day-by-day itinerary (${trip.durationDays || 3} days).
     - Include Morning, Afternoon, Evening plans, Where to Stay, Transport Tips, and Local Food.
     - At the very end of your response, output an exact JSON block listing 4 to 8 recommended places chosen strictly from the OSM list:
\`\`\`json
{
  "isItinerary": true,
  "recommendedPlaces": ["Place 1 from OSM list", "Place 2 from OSM list", "Place 3 from OSM list"]
}
\`\`\`
`;

  const contents = messages.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }));

  try {
    const { text, model } = await generateText(contents, systemInstruction);

    // Check if response contains an itinerary JSON block
    let isItinerary = isPlanRequest;
    let recommendedPlaces = [];
    let cleanText = text;

    const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.isItinerary) isItinerary = true;
        if (Array.isArray(parsed.recommendedPlaces)) {
          recommendedPlaces = parsed.recommendedPlaces;
        }
      } catch (_) {}
      cleanText = cleanText.replace(/```json\s*(\{[\s\S]*?\})\s*```/, "").trim();
    }

    res.json({
      success: true,
      text: cleanText,
      rawText: text,
      isItinerary,
      recommendedPlaces,
      model,
    });
  } catch (err) {
    console.error("[ai/sunshine/workspace-chat] Error:", err.message || err);
    res.status(500).json({ error: friendlyError(err) });
  }
});

export default router;