/**
 * Straight-line ("as the crow flies") distance between two lat/lon points,
 * using the haversine formula. Good enough for a prototype.
 *
 * Later this can be swapped for real road distance/duration by calling
 * OSRM's /route/v1 endpoint instead (see routes/distance.js for the seam).
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}
