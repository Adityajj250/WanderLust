/**
 * Deterministic mock generator for hotels (and a fallback for attractions).
 * Real hotel inventory has no free OSM equivalent with prices, so hotels
 * are mocked around the destination's coordinates. Swap this module out
 * for a real hotel-supplier API integration later — nothing else needs to change
 * as long as the same shape (name, lat, lon, price, rating, bookingUrl...) is returned.
 */

const HOTEL_NAME_PREFIXES = [
  "The Grand", "Sunset", "Coastal", "Royal", "Green Park", "Heritage",
  "Ocean View", "City Comfort", "Palm", "Silver Sands",
];
const HOTEL_NAME_SUFFIXES = ["Residency", "Inn", "Hotel", "Suites", "Retreat", "Palace"];

const AMENITY_POOL = ["Free WiFi", "AC", "Breakfast Included", "Pool", "Parking", "Restaurant", "Room Service"];

// Simple seeded pseudo-random so results are stable per destination query.
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

// Offsets a lat/lon by up to ~radiusKm in a deterministic pseudo-random direction.
function jitterCoords(lat, lon, radiusKm, rand) {
  const distKm = rand() * radiusKm;
  const angle = rand() * 2 * Math.PI;
  const dLat = (distKm / 111) * Math.cos(angle);
  const dLon = (distKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
  return { lat: lat + dLat, lon: lon + dLon };
}

export function generateMockHotels(destinationQuery, centerLat, centerLon, count = 6) {
  const rand = seededRandom(hashString(destinationQuery + ":hotels"));
  const hotels = [];

  for (let i = 0; i < count; i++) {
    const { lat, lon } = jitterCoords(centerLat, centerLon, 6, rand);
    const prefix = HOTEL_NAME_PREFIXES[Math.floor(rand() * HOTEL_NAME_PREFIXES.length)];
    const suffix = HOTEL_NAME_SUFFIXES[Math.floor(rand() * HOTEL_NAME_SUFFIXES.length)];
    const name = `${prefix} ${suffix}`;
    const price = Math.round((1200 + rand() * 6000) / 100) * 100; // ₹1200 - ₹7200, rounded to nearest 100
    const rating = Math.round((3 + rand() * 2) * 10) / 10; // 3.0 - 5.0
    const amenities = AMENITY_POOL.filter(() => rand() > 0.5);

    hotels.push({
      destinationQuery,
      name,
      address: `${name}, near ${destinationQuery}`,
      lat,
      lon,
      pricePerNight: price,
      currency: "INR",
      rating,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(name + i)}/400/250`,
      amenities: amenities.length ? amenities : ["Free WiFi"],
      // Placeholder booking link — replace with a real hotel-booking API/deep link later.
      bookingUrl: `https://example-booking.test/hotel/${encodeURIComponent(name)}?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`,
      source: "mock",
    });
  }

  return hotels;
}

// Fallback attractions used only if Overpass is unreachable, so the prototype still works offline.
export function generateMockAttractions(destinationQuery, centerLat, centerLon) {
  const rand = seededRandom(hashString(destinationQuery + ":attractions"));
  const templates = [
    { name: "Old Town Temple", category: "Temple", description: "A historic temple known for its architecture and local significance." },
    { name: "City Beach", category: "Beach", description: "A popular sandy beach, great for sunset views." },
    { name: "Heritage Museum", category: "Museum", description: "Displays regional history and artifacts." },
    { name: "Central Park", category: "Park", description: "A green space popular with families and joggers." },
    { name: "Hilltop Viewpoint", category: "Viewpoint", description: "Panoramic views over the surrounding area." },
    { name: "Historic Fort", category: "Historical", description: "Remains of an old fort with guided tours available." },
  ];

  return templates.map((t, i) => {
    const { lat, lon } = jitterCoords(centerLat, centerLon, 8, rand);
    return {
      destinationQuery,
      name: `${t.name}`,
      category: t.category,
      description: t.description,
      lat,
      lon,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(t.name + i)}/400/250`,
      source: "mock",
    };
  });
}

// Fallback transport hubs if Overpass returns none or fails.
export function generateMockTransportHubs(destinationQuery, centerLat, centerLon) {
  const rand = seededRandom(hashString(destinationQuery + ":transporthubs"));
  const capitalized = destinationQuery.charAt(0).toUpperCase() + destinationQuery.slice(1);
  const templates = [
    { name: `${capitalized} Central Railway Station`, type: "Railway Station", distKm: 4 },
    { name: `${capitalized} Intercity Bus Terminal (KSRTC/Main)`, type: "Bus Station", distKm: 2 },
    { name: `${capitalized} City Bus Stand`, type: "Bus Stop", distKm: 1 },
    { name: `${capitalized} Regional Airport`, type: "Airport", distKm: 18 },
  ];

  return templates.map((t) => {
    const { lat, lon } = jitterCoords(centerLat, centerLon, t.distKm, rand);
    return {
      destinationQuery,
      name: t.name,
      type: t.type,
      lat,
      lon,
      operator: t.type === "Airport" ? "AAI" : t.type === "Railway Station" ? "Indian Railways" : "City Transport",
      source: "mock",
    };
  });
}

// Helper to synthesize realistic pricing, rating and amenities for real OSM hotels
export function synthesizeHotelDetails(name, tags = {}, destinationQuery) {
  const seed = hashString((name || "") + ":" + (tags.osmId || "hotel"));
  const rand = seededRandom(seed);

  // Determine accommodation type
  const isResort = tags.tourism === "resort" || /resort/i.test(name);
  const isHostel = tags.tourism === "hostel" || /hostel|dorm/i.test(name);
  const isGuestHouse = tags.tourism === "guest_house" || /homestay|guest house/i.test(name);

  let basePrice = 2400;
  if (isResort) basePrice = 5200;
  else if (isHostel) basePrice = 900;
  else if (isGuestHouse) basePrice = 1500;

  const pricePerNight = Math.round((basePrice + rand() * (basePrice * 0.8)) / 100) * 100;

  let rating = 4.0;
  const parsedStars = parseFloat(tags.stars || tags["tourism:stars"] || tags["building:levels"]);
  if (!Number.isNaN(parsedStars) && parsedStars >= 1 && parsedStars <= 5) {
    rating = parsedStars;
  } else {
    rating = Math.round((3.6 + rand() * 1.3) * 10) / 10;
  }

  const amenities = [];
  if (tags.internet_access === "yes" || tags.wifi === "yes" || rand() > 0.3) amenities.push("Free WiFi");
  if (tags.air_conditioning === "yes" || rand() > 0.4) amenities.push("AC");
  if (tags.swimming_pool === "yes" || isResort || rand() > 0.6) amenities.push("Pool");
  if (rand() > 0.4) amenities.push("Breakfast Included");
  if (rand() > 0.5) amenities.push("Parking");
  if (isResort || rand() > 0.6) amenities.push("Restaurant");

  const address = tags["addr:street"]
    ? `${tags["addr:street"]}${tags["addr:city"] ? ", " + tags["addr:city"] : ""}`
    : tags["addr:city"] || `${destinationQuery}`;

  const bookingUrl =
    tags.website ||
    tags["contact:website"] ||
    `https://www.google.com/travel/hotels?q=${encodeURIComponent(name + " " + destinationQuery)}`;

  return {
    pricePerNight,
    rating,
    amenities: amenities.length ? amenities : ["Free WiFi", "AC"],
    address,
    bookingUrl,
  };
}
