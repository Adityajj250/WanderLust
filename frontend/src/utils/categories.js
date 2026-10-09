export const SIGHT_CATEGORIES = [
  {
    id: "all",
    label: "All Sights",
    icon: "🌟",
  },
  {
    id: "temple",
    label: "🛕 Temples & Worship",
    shortLabel: "Temples & Worship",
    icon: "🛕",
    group: "temples",
    matchTerms: [
      "temple",
      "worship",
      "mosque",
      "church",
      "cathedral",
      "shrine",
      "ashram",
      "gurudwara",
      "synagogue",
      "basilica",
      "mandir",
      "matha",
      "stupa",
      "hindu",
      "muslim",
      "christian",
      "jain",
      "buddhist",
      "sikh",
    ],
  },
  {
    id: "beach",
    label: "🏖️ Beaches & Waters",
    shortLabel: "Beaches & Waters",
    icon: "🏖️",
    group: "beaches",
    matchTerms: [
      "beach",
      "water",
      "sea",
      "ocean",
      "coast",
      "coastal",
      "swimming",
      "lake",
      "river",
      "waterfall",
      "falls",
      "island",
      "cove",
      "bay",
      "shore",
      "creek",
    ],
  },
  {
    id: "museum",
    label: "🏛️ Museums & Culture",
    shortLabel: "Museums & Culture",
    icon: "🏛️",
    group: "museums",
    matchTerms: [
      "museum",
      "culture",
      "cultural",
      "gallery",
      "theatre",
      "theater",
      "art",
      "arts",
      "opera",
      "exhibition",
      "planetarium",
      "science",
    ],
  },
  {
    id: "monument",
    label: "🗿 Monuments & Landmarks",
    shortLabel: "Monuments & Landmarks",
    icon: "🗿",
    group: "monuments",
    matchTerms: [
      "monument",
      "landmark",
      "statue",
      "memorial",
      "theme park",
      "amusement",
      "stadium",
      "tower",
      "plaza",
      "square",
      "gate",
      "bridge",
      "point of interest",
      "attraction",
      "pillar",
    ],
  },
  {
    id: "heritage",
    label: "🏰 Heritage & Forts",
    shortLabel: "Heritage & Forts",
    icon: "🏰",
    group: "heritage",
    matchTerms: [
      "heritage",
      "fort",
      "palace",
      "castle",
      "ruins",
      "archaeological",
      "historic",
      "historical",
      "ancient",
      "unesco",
      "mahal",
      "citadel",
      "bastion",
      "tomb",
    ],
  },
  {
    id: "nature",
    label: "🌅 Nature & Views",
    shortLabel: "Nature & Views",
    icon: "🌅",
    group: "nature",
    matchTerms: [
      "nature",
      "view",
      "viewpoint",
      "park",
      "garden",
      "reserve",
      "zoo",
      "wildlife",
      "safari",
      "sanctuary",
      "scenic",
      "hill",
      "peak",
      "cliff",
      "forest",
      "valley",
    ],
  },
  {
    id: "dining",
    label: "🍽️ Dining & Markets",
    shortLabel: "Dining & Markets",
    icon: "🍽️",
    group: "dining",
    matchTerms: [
      "dining",
      "restaurant",
      "cafe",
      "coffee",
      "food",
      "market",
      "marketplace",
      "bazaar",
      "mall",
      "shopping",
      "street food",
      "bakery",
      "sweets",
      "cuisine",
      "eatery",
      "diner",
      "pub",
    ],
  },
];

export function categorizeAttraction(a) {
  if (!a) return SIGHT_CATEGORIES[4]; // Default to Monuments & Landmarks

  const g = (a.group || "").toLowerCase();
  const cat = (a.category || "").toLowerCase();
  const name = (a.name || "").toLowerCase();
  const combined = `${g} ${cat} ${name}`;

  // 1. Direct group matching
  if (g === "temples") return SIGHT_CATEGORIES[1];
  if (g === "beaches") return SIGHT_CATEGORIES[2];
  if (g === "museums") return SIGHT_CATEGORIES[3];
  if (g === "monuments") return SIGHT_CATEGORIES[4];
  if (g === "heritage") return SIGHT_CATEGORIES[5];
  if (g === "nature") return SIGHT_CATEGORIES[6];
  if (g === "dining" || g === "shopping") return SIGHT_CATEGORIES[7];

  // 2. Keyword matching across category, group and name
  for (let i = 1; i < SIGHT_CATEGORIES.length; i++) {
    const filter = SIGHT_CATEGORIES[i];
    if (filter.matchTerms.some((kw) => combined.includes(kw))) {
      return filter;
    }
  }

  // 3. Fallback default to Monuments & Landmarks
  return SIGHT_CATEGORIES[4];
}
