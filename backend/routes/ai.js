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

// Always use gemini-3.1-flash-lite model
const MODEL_NAME = "gemini-3.1-flash-lite";

/**
 * POST /api/ai/plan-trip
 * Non-streaming itinerary generation using the JavaScript Interactions API
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
    const interaction = await ai.interactions.create({
      model: MODEL_NAME,
      input: prompt,
    });

    const rawText = interaction.output_text;

    if (!rawText) {
      throw new Error("No text output received from model.");
    }

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
      model: MODEL_NAME,
      interactionId: interaction.id,
    });
  } catch (err) {
    console.error(`[ai/plan-trip] Error calling ${MODEL_NAME}:`, err.message || err);
    res.status(500).json({
      error: err.message || "Failed to generate AI trip plan.",
    });
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
    const stream = await ai.interactions.create({
      model: MODEL_NAME,
      input: prompt,
      stream: true,
    });

    for await (const event of stream) {
      if (event.event_type === "step.delta" && event.delta?.type === "text") {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      } else if (event.event_type === "interaction.completed") {
        res.write(`data: ${JSON.stringify({ done: true, interactionId: event.interaction?.id })}\n\n`);
      }
    }
    res.end();
  } catch (err) {
    console.error(`[ai/plan-trip-stream] Error streaming ${MODEL_NAME}:`, err.message || err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/ai/chat
 * Multi-turn conversations using previous_interaction_id
 */
router.post("/chat", async (req, res) => {
  const { message, previous_interaction_id } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message string is required." });
  }

  try {
    const interaction = await ai.interactions.create({
      model: MODEL_NAME,
      input: message,
      previous_interaction_id: previous_interaction_id || undefined,
    });

    res.json({
      success: true,
      id: interaction.id,
      output_text: interaction.output_text,
      model: MODEL_NAME,
    });
  } catch (err) {
    console.error(`[ai/chat] Error in multi-turn chat:`, err.message || err);
    res.status(500).json({ error: err.message || "Failed to continue conversation." });
  }
});

export default router;
