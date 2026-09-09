/**
 * Utility to parse Gemini-generated travel itineraries into structured objects
 * for rich, interactive UI rendering.
 */

export function parseItinerary(rawText = "") {
  if (!rawText || typeof rawText !== "string") {
    return {
      title: "Trip Itinerary",
      summary: "",
      days: [],
      whereToStay: "",
      transport: "",
      cuisine: "",
      tips: "",
      rawText: "",
    };
  }

  // Extract Main Title (# ...)
  let title = "Custom Trip Itinerary";
  const titleMatch = rawText.match(/^#\s*([^\n]+)/m);
  if (titleMatch) {
    title = titleMatch[1].replace(/^[🗺️✨📍\s]+/, "").trim();
  }

  // Extract Summary (## Trip Highlights & Summary)
  let summary = "";
  const summaryMatch = rawText.match(/##\s*[^#\n]*Highlights[^#\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (summaryMatch) {
    summary = cleanText(summaryMatch[1]);
  }

  // Extract Day-by-Day Schedule
  const days = [];
  // Match Day headers: ### Day 1: Title or ### Day 1 - Title
  const dayHeaderRegex = /###\s*Day\s*(\d+)[:\s–-]+([^\n]+)/gi;
  const dayIndices = [];
  let dayMatch;

  while ((dayMatch = dayHeaderRegex.exec(rawText)) !== null) {
    dayIndices.push({
      dayNum: parseInt(dayMatch[1], 10),
      title: dayMatch[2].trim(),
      startIndex: dayMatch.index + dayMatch[0].length,
    });
  }

  for (let i = 0; i < dayIndices.length; i++) {
    const current = dayIndices[i];
    const nextIndex = i + 1 < dayIndices.length ? dayIndices[i + 1].startIndex - 15 : rawText.length;
    // Limit to before next ## header if it's the last day
    const dayTextRaw = rawText.slice(current.startIndex, nextIndex);
    const dayText = dayTextRaw.split(/\n##\s/)[0].trim();

    // Extract Morning, Afternoon, Evening
    const morningMatch = dayText.match(/(?:^|\n)(?:-\s*)?\*\*🌅?\s*Morning[^*]*\*\*[:\s]*([\s\S]*?)(?=(?:\n(?:-\s*)?\*\*☀️|\n(?:-\s*)?\*\*🌙|$))/i);
    const afternoonMatch = dayText.match(/(?:^|\n)(?:-\s*)?\*\*☀️?\s*Afternoon[^*]*\*\*[:\s]*([\s\S]*?)(?=(?:\n(?:-\s*)?\*\*🌙|$))/i);
    const eveningMatch = dayText.match(/(?:^|\n)(?:-\s*)?\*\*🌙?\s*Evening[^*]*\*\*[:\s]*([\s\S]*?)$/i);

    const morning = morningMatch ? cleanText(morningMatch[1]) : "";
    const afternoon = afternoonMatch ? cleanText(afternoonMatch[1]) : "";
    const evening = eveningMatch ? cleanText(eveningMatch[1]) : "";

    days.push({
      dayNum: current.dayNum,
      title: current.title,
      morning,
      afternoon,
      evening,
      rawBody: cleanText(dayText),
    });
  }

  // Extract Where to Stay
  let whereToStay = "";
  const stayMatch = rawText.match(/##\s*[^#\n]*Where to Stay[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (stayMatch) whereToStay = cleanText(stayMatch[1]);

  // Extract Transportation Advice
  let transport = "";
  const transMatch = rawText.match(/##\s*[^#\n]*Transport[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (transMatch) transport = cleanText(transMatch[1]);

  // Extract Cuisine
  let cuisine = "";
  const cuisineMatch = rawText.match(/##\s*[^#\n]*Cuisine[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (cuisineMatch) cuisine = cleanText(cuisineMatch[1]);

  // Extract Tips
  let tips = "";
  const tipsMatch = rawText.match(/##\s*[^#\n]*Tips[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (tipsMatch) tips = cleanText(tipsMatch[1]);

  return {
    title,
    summary,
    days,
    whereToStay,
    transport,
    cuisine,
    tips,
    rawText,
  };
}

function cleanText(text = "") {
  return text
    .replace(/^[-*]\s+/gm, "") // remove leading bullet dashes
    .trim();
}
