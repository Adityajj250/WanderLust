/**
 * Location Optimization Scoring Engine
 * Evaluates hotel options based on proximity to selected sights, arrival terminal,
 * price-to-quality value, and overall travel convenience.
 */

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number"
  ) {
    return 5.0; // fallback default
  }

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Calculates location scores and ranks for a list of hotels.
 * @param {Array} hotels - List of hotel objects
 * @param {Array} targetAttractions - User's selected attractions or top attractions
 * @param {Object} arrivalPoint - Selected arrival terminal or destination center
 * @returns {Array} Array of scored hotel objects with ranking badges
 */
export function computeHotelLocationScores(hotels = [], targetAttractions = [], arrivalPoint = null) {
  if (!hotels || hotels.length === 0) return [];

  // If no target attractions provided, nothing to optimize against
  const sights = targetAttractions.length > 0 ? targetAttractions : [];

  const scoredHotels = hotels.map((hotel) => {
    // 1. Average distance to sights
    let avgDistToAttractions = 4.0;
    const attractionDistances = [];

    if (sights.length > 0) {
      let totalDist = 0;
      sights.forEach((sight) => {
        const d = haversineDistanceKm(hotel.lat, hotel.lon, sight.lat, sight.lon);
        attractionDistances.push({
          name: sight.name,
          category: sight.category,
          distanceKm: d,
        });
        totalDist += d;
      });
      avgDistToAttractions = Math.round((totalDist / sights.length) * 10) / 10;
    }

    // 2. Distance to arrival point / transit hub
    let distToArrival = 3.5;
    if (arrivalPoint && typeof arrivalPoint.lat === "number") {
      distToArrival = haversineDistanceKm(hotel.lat, hotel.lon, arrivalPoint.lat, arrivalPoint.lon);
    }

    // 3. Compute Location Score (0 - 100)
    // Base 100
    // Proximity penalty: avg distance to sights is weighted heavily (-4.5 pts per km)
    // Transit penalty: distance to arrival hub (-2.5 pts per km)
    // Quality bonus: rating bonus (+8 pts for 4.5+ rating)
    const rating = hotel.rating || 4.0;
    const price = hotel.pricePerNight || 3000;

    let score = 100 - (avgDistToAttractions * 4.5) - (distToArrival * 2.2) + ((rating - 3.5) * 8);

    // Normalize and clamp between 25 and 98
    score = Math.max(25, Math.min(98, Math.round(score)));

    // Value ratio (Location Score per 1000 rupees)
    const valueRatio = Math.round((score / (price / 1000)) * 10) / 10;

    return {
      ...hotel,
      locationScore: score,
      avgDistToAttractions,
      distToArrival,
      attractionDistances,
      valueRatio,
    };
  });

  // Sort descending by location score
  scoredHotels.sort((a, b) => b.locationScore - a.locationScore);

  // Determine badges:
  // 🥇 Best Overall: Highest location score among hotels with rating >= 4.2
  const bestOverallCandidate = scoredHotels.find((h) => (h.rating || 0) >= 4.2) || scoredHotels[0];
  const bestOverallId = bestOverallCandidate?._id || bestOverallCandidate?.osmId || bestOverallCandidate?.name;

  // 🥈 Best Value: Highest valueRatio among hotels with score >= 70
  const valueCandidates = [...scoredHotels].sort((a, b) => b.valueRatio - a.valueRatio);
  const bestValueCandidate = valueCandidates.find(
    (h) =>
      h.locationScore >= 70 &&
      (h._id || h.osmId || h.name) !== bestOverallId
  ) || valueCandidates[0];
  const bestValueId = bestValueCandidate?._id || bestValueCandidate?.osmId || bestValueCandidate?.name;

  // 🥉 Budget Pick: Lowest price among hotels with score >= 65
  const budgetCandidates = [...scoredHotels].sort((a, b) => (a.pricePerNight || 0) - (b.pricePerNight || 0));
  const budgetCandidate = budgetCandidates.find(
    (h) =>
      h.locationScore >= 65 &&
      (h._id || h.osmId || h.name) !== bestOverallId &&
      (h._id || h.osmId || h.name) !== bestValueId
  ) || budgetCandidates[0];
  const budgetPickId = budgetCandidate?._id || budgetCandidate?.osmId || budgetCandidate?.name;

  return scoredHotels.map((h) => {
    const key = h._id || h.osmId || h.name;
    let badge = null;
    if (key === bestOverallId) {
      badge = { label: "🥇 Best Overall", type: "best-overall" };
    } else if (key === bestValueId) {
      badge = { label: "🥈 Best Value", type: "best-value" };
    } else if (key === budgetPickId) {
      badge = { label: "🥉 Budget Option", type: "budget-option" };
    }

    return {
      ...h,
      badge,
    };
  });
}
