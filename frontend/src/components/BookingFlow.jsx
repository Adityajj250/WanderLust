import React, { useState, useMemo, useEffect } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────

const MODE_OPTIONS = [
  { id: 'flight', icon: '✈️', label: 'Flight / Airport' },
  { id: 'train',  icon: '🚉', label: 'Train / Railway'  },
  { id: 'bus',    icon: '🚌', label: 'Bus / Transit'    },
];

const ROOM_TYPES = [
  { id: 'single', label: '🛏️ Single Room', note: '1 Bed · Compact', delta: -500 },
  { id: 'double', label: '🛏️🛏️ Double Room', note: '2 Beds · Standard', delta: 0 },
  { id: 'deluxe', label: '👑 Deluxe Suite', note: 'King Bed · Balcony View', delta: 1500 },
];

const BED_PREFERENCES = [
  '1 King Bed',
  '2 Twin Beds',
  'Flexible / Any',
];

const TIME_SLOTS = [
  'Morning (09:00 - 13:00)',
  'Afternoon (13:00 - 17:00)',
  'Evening / Sunset (17:00 - 20:00)',
  'Full Day Flexible',
];

// Helper to generate tiered options: Budget, Comfort, Premium
function generateTierResults(mode, origin, dest, travellers) {
  const n = Math.max(1, Number(travellers) || 1);
  const org = origin || 'Origin';
  const dst = dest || 'Destination';

  if (mode === 'flight') {
    return [
      {
        tier: 'Budget',
        tierIcon: '💸',
        tierBadge: 'Best Value',
        operator: 'IndiGo Express',
        code: '6E-408',
        depTime: '06:15',
        arrTime: '08:45',
        duration: '2h 30m',
        route: `${org} (Airport) ➔ ${dst}`,
        perPerson: 3200,
        total: 3200 * n,
        features: ['Cabin bag 7kg', 'Standard seat', 'Non-refundable'],
      },
      {
        tier: 'Comfort',
        tierIcon: '🌟',
        tierBadge: 'Most Popular',
        operator: 'Air India',
        code: 'AI-632',
        depTime: '10:30',
        arrTime: '13:00',
        duration: '2h 30m',
        route: `${org} (Airport) ➔ ${dst}`,
        perPerson: 5400,
        total: 5400 * n,
        features: ['Check-in 15kg included', 'Free meal', 'Free seat selection'],
      },
      {
        tier: 'Premium',
        tierIcon: '💎',
        tierBadge: 'Luxury Experience',
        operator: 'Vistara Club',
        code: 'UK-821',
        depTime: '15:15',
        arrTime: '17:40',
        duration: '2h 25m',
        route: `${org} (Airport) ➔ ${dst}`,
        perPerson: 9800,
        total: 9800 * n,
        features: ['Priority check-in & lounge', 'Gourmet meal', 'Extra legroom seat'],
      },
    ];
  }

  if (mode === 'bus') {
    return [
      {
        tier: 'Budget',
        tierIcon: '💸',
        tierBadge: 'Economy Travel',
        operator: 'State Express Transport',
        code: 'SETC-109',
        depTime: '20:30',
        arrTime: '05:30+1',
        duration: '9h 00m',
        route: `${org} (Central Bus Stand) ➔ ${dst}`,
        perPerson: 380,
        total: 380 * n,
        features: ['Push-back seating', 'Charging point', 'Standard stops'],
      },
      {
        tier: 'Comfort',
        tierIcon: '🌟',
        tierBadge: 'AC Sleeper',
        operator: 'VRL Travels Executive',
        code: 'VRL-771',
        depTime: '21:15',
        arrTime: '06:00+1',
        duration: '8h 45m',
        route: `${org} (Private Hub) ➔ ${dst}`,
        perPerson: 750,
        total: 750 * n,
        features: ['AC Upper/Lower Sleeper', 'Water bottle & blanket', 'Live GPS tracking'],
      },
      {
        tier: 'Premium',
        tierIcon: '💎',
        tierBadge: 'Multi-Axle Volvo',
        operator: 'SRS Volvo Multi-Axle',
        code: 'SRS-990',
        depTime: '22:00',
        arrTime: '06:30+1',
        duration: '8h 30m',
        route: `${org} (Express Hub) ➔ ${dst}`,
        perPerson: 1200,
        total: 1200 * n,
        features: ['Volvo B11R AC Sleeper', 'Personal LED screen', 'Snack box included'],
      },
    ];
  }

  // Default: train
  return [
    {
      tier: 'Budget',
      tierIcon: '💸',
      tierBadge: 'Sleeper Class',
      operator: 'Superfast Mail Express',
      code: '12658',
      depTime: '19:45',
      arrTime: '06:30+1',
      duration: '10h 45m',
      route: `${org} (Junction) ➔ ${dst}`,
      perPerson: 420,
      total: 420 * n,
      features: ['Sleeper (SL) berth', 'Confirmed reservation', 'Standard travel'],
    },
    {
      tier: 'Comfort',
      tierIcon: '🌟',
      tierBadge: '3-Tier AC',
      operator: 'Rajdhani / Express AC',
      code: '12432',
      depTime: '06:30',
      arrTime: '15:15',
      duration: '8h 45m',
      route: `${org} (Junction) ➔ ${dst}`,
      perPerson: 1150,
      total: 1150 * n,
      features: ['3AC Berth with Bedroll', 'Clean linen & meals', 'Air-conditioned'],
    },
    {
      tier: 'Premium',
      tierIcon: '💎',
      tierBadge: 'Executive / 1st AC',
      operator: 'Vande Bharat / Tejas Express',
      code: '20601',
      depTime: '08:00',
      arrTime: '14:30',
      duration: '6h 30m',
      route: `${org} (Terminal) ➔ ${dst}`,
      perPerson: 2100,
      total: 2100 * n,
      features: ['Executive Chair Car / 1AC', 'Hot meals served at seat', 'Fastest travel time'],
    },
  ];
}

export default function BookingFlow({
  trip,
  destination,
  cityName,
  transportHubs = [],
  onBack,
  bookingState = {},
  setBookingState,
}) {
  // Accordion open states (can open one or multiple)
  const [openPanels, setOpenPanels] = useState({
    arrival: true,
    hotel: false,
    cab: false,
    places: false,
    return: false,
  });

  function togglePanel(id) {
    setOpenPanels((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. ARRIVAL STATE
  // ──────────────────────────────────────────────────────────────────────────
  const savedArrival = bookingState.arrival || null;
  const [arrOrigin, setArrOrigin] = useState(savedArrival?.origin || '');
  const [arrDate, setArrDate] = useState(savedArrival?.date || trip.startDate || '');
  const [arrTravellers, setArrTravellers] = useState(savedArrival?.travellers || trip.travellers || 1);
  const [arrMode, setArrMode] = useState(savedArrival?.mode || 'train');
  const [arrNearbyHub, setArrNearbyHub] = useState(savedArrival?.nearbyHub || '');
  const [arrLocatingHub, setArrLocatingHub] = useState(false);

  const [arrSearchLoading, setArrSearchLoading] = useState(false);
  const [arrSearchResults, setArrSearchResults] = useState(savedArrival?.searchResults || null);
  const [arrSelectedIdx, setArrSelectedIdx] = useState(savedArrival?.selectedIdx ?? null);
  const [arrBookingLoading, setArrBookingLoading] = useState(false);

  // Attempt to locate nearby airport/station for the origin city using OSM Nominatim
  async function lookupOriginHub(originName, mode) {
    if (!originName || originName.trim().length < 2) return;
    setArrLocatingHub(true);
    try {
      const q = encodeURIComponent(`${originName} ${mode === 'flight' ? 'airport' : mode === 'bus' ? 'bus station' : 'railway station'}`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { 'User-Agent': 'WanderLust-TravelPlanner/2.0' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const shortName = data[0].display_name.split(',').slice(0, 2).join(', ');
          setArrNearbyHub(shortName);
          setArrLocatingHub(false);
          return;
        }
      }
    } catch (_) {}
    // Fallback mock hub naming based on mode
    const title = originName.trim();
    if (mode === 'flight') setArrNearbyHub(`${title} International Airport (OSM Identified)`);
    else if (mode === 'bus') setArrNearbyHub(`${title} Central Bus Terminal`);
    else setArrNearbyHub(`${title} Junction Railway Station`);
    setArrLocatingHub(false);
  }

  function handleSearchArrival() {
    if (!arrOrigin.trim()) return;
    setArrSearchLoading(true);
    setArrSearchResults(null);
    setArrSelectedIdx(null);

    lookupOriginHub(arrOrigin, arrMode);

    setTimeout(() => {
      const results = generateTierResults(arrMode, arrOrigin, cityName, arrTravellers);
      setArrSearchResults(results);
      setArrSearchLoading(false);
    }, 1200);
  }

  function handleBookArrival() {
    if (arrSelectedIdx === null || !arrSearchResults) return;
    setArrBookingLoading(true);
    setTimeout(() => {
      const bookedData = {
        origin: arrOrigin,
        destination: cityName,
        date: arrDate,
        travellers: arrTravellers,
        mode: arrMode,
        nearbyHub: arrNearbyHub,
        selectedOption: arrSearchResults[arrSelectedIdx],
        selectedIdx: arrSelectedIdx,
        searchResults: arrSearchResults,
        bookedAt: new Date().toLocaleTimeString(),
      };
      setBookingState((prev) => ({ ...prev, arrival: bookedData }));
      setArrBookingLoading(false);
      // Auto open next panel for smooth journey
      setOpenPanels((p) => ({ ...p, hotel: true }));
    }, 1600);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. HOTEL STATE
  // ──────────────────────────────────────────────────────────────────────────
  const savedHotelBooking = bookingState.hotel || null;
  const targetHotel = trip.selectedHotel;
  const [hotelRoomType, setHotelRoomType] = useState(savedHotelBooking?.roomType || 'double');
  const [hotelBedPref, setHotelBedPref] = useState(savedHotelBooking?.bedPref || '1 King Bed');
  const [hotelSmoking, setHotelSmoking] = useState(savedHotelBooking?.smoking || 'Non-Smoking');
  const [hotelCheckIn, setHotelCheckIn] = useState(savedHotelBooking?.checkIn || trip.startDate || '');
  const [hotelCheckOut, setHotelCheckOut] = useState(savedHotelBooking?.checkOut || trip.endDate || '');
  const [hotelSpecialReq, setHotelSpecialReq] = useState(savedHotelBooking?.specialReq || '');
  const [hotelBookingLoading, setHotelBookingLoading] = useState(false);

  const roomDelta = ROOM_TYPES.find((r) => r.id === hotelRoomType)?.delta || 0;
  const hotelRatePerNight = (targetHotel?.pricePerNight || 3200) + roomDelta;
  const hotelTotalCost = hotelRatePerNight * (trip.durationDays || 3);

  function handleBookHotel() {
    setHotelBookingLoading(true);
    setTimeout(() => {
      const bookedData = {
        hotelName: targetHotel?.name || 'Selected Stay',
        hotelIcon: targetHotel?.icon || '🏨',
        roomType: hotelRoomType,
        bedPref: hotelBedPref,
        smoking: hotelSmoking,
        checkIn: hotelCheckIn,
        checkOut: hotelCheckOut,
        specialReq: hotelSpecialReq,
        ratePerNight: hotelRatePerNight,
        durationDays: trip.durationDays || 3,
        totalCost: hotelTotalCost,
        bookedAt: new Date().toLocaleTimeString(),
      };
      setBookingState((prev) => ({ ...prev, hotel: bookedData }));
      setHotelBookingLoading(false);
      setOpenPanels((p) => ({ ...p, cab: true }));
    }, 1600);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CAB SERVICE STATE
  // ──────────────────────────────────────────────────────────────────────────
  const savedCabBooking = bookingState.cab || null;
  const targetCab = trip.selectedCab || {
    id: 'sedan',
    name: 'Dedicated AC Sedan (Dzire / Etios)',
    fare: 2800,
    icon: '🚕',
  };
  const destinationHub =
    trip.arrivalHub ||
    transportHubs.find((h) => h.type === 'Railway Station') ||
    transportHubs.find((h) => h.type === 'Airport') ||
    transportHubs[0] || { name: `${cityName} Arrival Terminal`, type: 'Transit Hub' };

  const [cabPickupWanted, setCabPickupWanted] = useState(
    savedCabBooking?.pickupWanted !== undefined ? savedCabBooking.pickupWanted : true
  );
  const [cabPickupTime, setCabPickupTime] = useState(savedCabBooking?.pickupTime || '09:30');
  const [cabFlightOrTrainNo, setCabFlightOrTrainNo] = useState(savedCabBooking?.flightOrTrainNo || '');
  const [cabLuggageCount, setCabLuggageCount] = useState(savedCabBooking?.luggageCount || 2);
  const [cabBookingLoading, setCabBookingLoading] = useState(false);

  function handleBookCab() {
    setCabBookingLoading(true);
    setTimeout(() => {
      const bookedData = {
        cabName: targetCab.name,
        cabIcon: targetCab.icon || '🚕',
        pickupWanted: cabPickupWanted,
        pickupPoint: destinationHub.name,
        dropPoint: targetHotel?.name || `${cityName} Hotel`,
        pickupTime: cabPickupTime,
        flightOrTrainNo: cabFlightOrTrainNo,
        luggageCount: cabLuggageCount,
        fare: targetCab.fare || 2800,
        bookedAt: new Date().toLocaleTimeString(),
      };
      setBookingState((prev) => ({ ...prev, cab: bookedData }));
      setCabBookingLoading(false);
      setOpenPanels((p) => ({ ...p, places: true }));
    }, 1600);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TOURIST PLACES / TICKETS STATE
  // ──────────────────────────────────────────────────────────────────────────
  const savedPlacesBooking = bookingState.places || null;
  const initialAttractionsState = useMemo(() => {
    const list = trip.selectedAttractions.length > 0 ? trip.selectedAttractions : [];
    const map = {};
    list.forEach((att, idx) => {
      const key = att._id || att.osmId || att.name;
      const isFree =
        att.category === 'Place of Worship' ||
        att.category === 'Beach' ||
        att.category === 'Park & Nature' ||
        att.category === 'Nature & Scenic Spot' ||
        att.category === 'Waterfall';
      const basePrice = isFree ? 0 : 50 + (idx % 3) * 50;

      map[key] = {
        name: att.name,
        icon: att.icon || '🏛️',
        category: att.category || 'Sight',
        selected: true,
        isFree,
        price: basePrice,
        visitors: trip.tickets?.[key]?.qty || 2,
        timeSlot: 'Morning (09:00 - 13:00)',
        needGuide: false,
      };
    });
    return map;
  }, [trip.selectedAttractions, trip.tickets]);

  const [placesTickets, setPlacesTickets] = useState(() => {
    if (savedPlacesBooking?.tickets) return savedPlacesBooking.tickets;
    return initialAttractionsState;
  });
  const [placesBookingLoading, setPlacesBookingLoading] = useState(false);

  const placesTotalCost = useMemo(() => {
    return Object.values(placesTickets).reduce((sum, item) => {
      if (!item.selected) return sum;
      const tCost = item.isFree ? 0 : item.price * item.visitors;
      const guideCost = item.needGuide ? 400 : 0;
      return sum + tCost + guideCost;
    }, 0);
  }, [placesTickets]);

  const selectedPlacesCount = Object.values(placesTickets).filter((t) => t.selected).length;

  function handleBookPlaces() {
    setPlacesBookingLoading(true);
    setTimeout(() => {
      const bookedData = {
        tickets: placesTickets,
        count: selectedPlacesCount,
        totalCost: placesTotalCost,
        bookedAt: new Date().toLocaleTimeString(),
      };
      setBookingState((prev) => ({ ...prev, places: bookedData }));
      setPlacesBookingLoading(false);
      setOpenPanels((p) => ({ ...p, return: true }));
    }, 1600);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. RETURN STATE (Places reversed from Arrival)
  // ──────────────────────────────────────────────────────────────────────────
  const savedReturn = bookingState.return || null;
  const returnFromCity = cityName;
  const [retToCity, setRetToCity] = useState(savedReturn?.to || arrOrigin || '');
  const [retDate, setRetDate] = useState(savedReturn?.date || trip.endDate || '');
  const [retTravellers, setRetTravellers] = useState(savedReturn?.travellers || arrTravellers || 1);
  const [retMode, setRetMode] = useState(savedReturn?.mode || arrMode || 'train');
  const [retNearbyHub, setRetNearbyHub] = useState(savedReturn?.nearbyHub || '');

  const [retSearchLoading, setRetSearchLoading] = useState(false);
  const [retSearchResults, setRetSearchResults] = useState(savedReturn?.searchResults || null);
  const [retSelectedIdx, setRetSelectedIdx] = useState(savedReturn?.selectedIdx ?? null);
  const [retBookingLoading, setRetBookingLoading] = useState(false);

  // Sync return destination if arrival origin changes and return is untouched
  useEffect(() => {
    if (arrOrigin && !retToCity && !savedReturn) {
      setRetToCity(arrOrigin);
    }
  }, [arrOrigin, retToCity, savedReturn]);

  function handleSearchReturn() {
    if (!retToCity.trim()) return;
    setRetSearchLoading(true);
    setRetSearchResults(null);
    setRetSelectedIdx(null);

    setTimeout(() => {
      const results = generateTierResults(retMode, returnFromCity, retToCity, retTravellers);
      setRetSearchResults(results);
      setRetNearbyHub(`${returnFromCity} Return Departure Point`);
      setRetSearchLoading(false);
    }, 1200);
  }

  function handleBookReturn() {
    if (retSelectedIdx === null || !retSearchResults) return;
    setRetBookingLoading(true);
    setTimeout(() => {
      const bookedData = {
        origin: returnFromCity,
        destination: retToCity,
        date: retDate,
        travellers: retTravellers,
        mode: retMode,
        nearbyHub: retNearbyHub,
        selectedOption: retSearchResults[retSelectedIdx],
        selectedIdx: retSelectedIdx,
        searchResults: retSearchResults,
        bookedAt: new Date().toLocaleTimeString(),
      };
      setBookingState((prev) => ({ ...prev, return: bookedData }));
      setRetBookingLoading(false);
    }, 1600);
  }

  // Count total completed bookings
  const bookedSectionsCount = ['arrival', 'hotel', 'cab', 'places', 'return'].filter(
    (k) => !!bookingState[k]
  ).length;

  return (
    <div className="booking-flow-container">
      {/* Top Banner Navigation */}
      <div className="booking-flow-topbar">
        <button type="button" className="booking-back-btn" onClick={onBack}>
          ← Back to Trip Summary
        </button>
        <div className="booking-header-text">
          <h2 className="booking-main-title">Book now for smooth experience</h2>
          <p className="booking-sub-title">
            Complete screen booking portal · All modules are optional — customize and book as you prefer.
          </p>
        </div>
        <div className="booking-progress-badge">
          <span className="badge-count">{bookedSectionsCount} / 5</span>
          <span className="badge-label">Services Booked</span>
        </div>
      </div>

      {/* Accordion Panels Container */}
      <div className="booking-accordions-wrapper">
        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 1. ARRIVAL PANEL                                                   */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className={`booking-accordion-card ${openPanels.arrival ? 'expanded' : ''} ${bookingState.arrival ? 'is-confirmed' : ''}`}>
          <div className="accordion-header" onClick={() => togglePanel('arrival')}>
            <div className="header-left">
              <span className="accordion-icon">✈️</span>
              <div className="header-titles">
                <h3>1. Arrival Transfer & Travel</h3>
                <span className="header-preview-text">
                  {bookingState.arrival
                    ? `Booked: ${bookingState.arrival.selectedOption?.operator} (${bookingState.arrival.mode.toUpperCase()}) from ${bookingState.arrival.origin}`
                    : `Travel from your home city to ${cityName}`}
                </span>
              </div>
            </div>
            <div className="header-right">
              {bookingState.arrival ? (
                <span className="status-tag booked-tag">✅ Booked</span>
              ) : (
                <span className="status-tag optional-tag">Optional</span>
              )}
              <span className="accordion-chevron">{openPanels.arrival ? '▲' : '▼'}</span>
            </div>
          </div>

          {openPanels.arrival && (
            <div className="accordion-body">
              {bookingState.arrival ? (
                <div className="booking-success-box">
                  <div className="success-icon">🎉</div>
                  <div className="success-details">
                    <h4>Arrival Confirmed & Booked!</h4>
                    <p>
                      <strong>{bookingState.arrival.selectedOption?.tier} Tier</strong> ·{' '}
                      {bookingState.arrival.selectedOption?.operator} ({bookingState.arrival.selectedOption?.code})
                    </p>
                    <p className="sub-info">
                      Route: {bookingState.arrival.origin} ➔ {bookingState.arrival.destination} ·{' '}
                      Date: {bookingState.arrival.date || 'Flexible'} · Travellers: {bookingState.arrival.travellers}
                    </p>
                    {bookingState.arrival.nearbyHub && (
                      <p className="hub-badge">📍 Departure Hub: {bookingState.arrival.nearbyHub}</p>
                    )}
                    <span className="booked-timestamp">Booked at {bookingState.arrival.bookedAt}</span>
                  </div>
                  <button
                    type="button"
                    className="modify-btn"
                    onClick={() => setBookingState((prev) => ({ ...prev, arrival: null }))}
                  >
                    Modify Arrival
                  </button>
                </div>
              ) : arrBookingLoading ? (
                <div className="booking-processing-overlay">
                  <div className="processing-spinner" />
                  <p>Securing tickets & confirming your arrival booking…</p>
                </div>
              ) : (
                <div className="form-content-grid">
                  <div className="form-row">
                    <label>Enter Your Current City / Location</label>
                    <div className="input-with-hint">
                      <input
                        type="text"
                        placeholder="e.g. Mumbai, New Delhi, Bengaluru, Kochi..."
                        value={arrOrigin}
                        onChange={(e) => setArrOrigin(e.target.value)}
                        className="primary-input"
                      />
                      {arrNearbyHub && (
                        <span className="hub-locator-pill">
                          📍 Identified Station/Airport: <strong>{arrNearbyHub}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-row-multi">
                    <div className="form-col">
                      <label>Travel Date</label>
                      <input
                        type="date"
                        value={arrDate}
                        onChange={(e) => setArrDate(e.target.value)}
                        className="primary-input"
                      />
                    </div>
                    <div className="form-col">
                      <label>Number of Travellers</label>
                      <div className="travellers-stepper">
                        <button
                          type="button"
                          onClick={() => setArrTravellers((v) => Math.max(1, v - 1))}
                        >
                          −
                        </button>
                        <span>{arrTravellers}</span>
                        <button
                          type="button"
                          onClick={() => setArrTravellers((v) => Math.min(20, v + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <label>Preferred Mode of Travel</label>
                    <div className="mode-selection-pills">
                      {MODE_OPTIONS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`mode-pill ${arrMode === m.id ? 'active' : ''}`}
                          onClick={() => {
                            setArrMode(m.id);
                            setArrSearchResults(null);
                            setArrSelectedIdx(null);
                          }}
                        >
                          <span className="pill-icon">{m.icon}</span>
                          <span className="pill-label">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="action-btn-row">
                    <button
                      type="button"
                      className="search-service-btn"
                      onClick={handleSearchArrival}
                      disabled={!arrOrigin.trim() || arrSearchLoading}
                    >
                      {arrSearchLoading ? '🔍 Querying OSM & Schedules…' : `🔍 Search ${arrMode.toUpperCase()} Options`}
                    </button>
                  </div>

                  {/* Search Results Display with Budget, Comfort, Premium */}
                  {arrSearchResults && (
                    <div className="results-showcase-section">
                      <h4>Available Options from {arrOrigin} to {cityName}:</h4>
                      <div className="tier-cards-grid">
                        {arrSearchResults.map((res, idx) => (
                          <div
                            key={idx}
                            className={`tier-card ${res.tier.toLowerCase()} ${arrSelectedIdx === idx ? 'selected' : ''}`}
                            onClick={() => setArrSelectedIdx(idx)}
                          >
                            <div className="tier-card-header">
                              <span className="tier-tag">
                                {res.tierIcon} {res.tier}
                              </span>
                              <span className="tier-badge-label">{res.tierBadge}</span>
                            </div>
                            <div className="tier-card-operator">
                              <strong>{res.operator}</strong>
                              <span className="operator-code">{res.code}</span>
                            </div>
                            <div className="tier-timings">
                              <span className="time-dep">{res.depTime}</span>
                              <span className="time-arrow">➔</span>
                              <span className="time-arr">{res.arrTime}</span>
                              <span className="time-dur">({res.duration})</span>
                            </div>
                            <ul className="tier-features-list">
                              {res.features.map((f, i) => (
                                <li key={i}>✓ {f}</li>
                              ))}
                            </ul>
                            <div className="tier-card-footer">
                              <span className="price-total">₹{res.total.toLocaleString('en-IN')}</span>
                              <span className="price-per-person">₹{res.perPerson}/person</span>
                            </div>
                            <button
                              type="button"
                              className={`select-tier-btn ${arrSelectedIdx === idx ? 'active' : ''}`}
                            >
                              {arrSelectedIdx === idx ? '✓ Selected' : 'Choose Option'}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="confirm-booking-row">
                        <button
                          type="button"
                          className="confirm-book-btn"
                          onClick={handleBookArrival}
                          disabled={arrSelectedIdx === null}
                        >
                          🎫 Book Selected Arrival Option
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 2. HOTEL SERVICE PANEL                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className={`booking-accordion-card ${openPanels.hotel ? 'expanded' : ''} ${bookingState.hotel ? 'is-confirmed' : ''}`}>
          <div className="accordion-header" onClick={() => togglePanel('hotel')}>
            <div className="header-left">
              <span className="accordion-icon">🏨</span>
              <div className="header-titles">
                <h3>2. Hotel Accommodation</h3>
                <span className="header-preview-text">
                  {bookingState.hotel
                    ? `Booked: ${bookingState.hotel.hotelName} (${bookingState.hotel.roomType.toUpperCase()})`
                    : targetHotel
                    ? `Confirm Stay at ${targetHotel.name}`
                    : 'Select room & guest preferences'}
                </span>
              </div>
            </div>
            <div className="header-right">
              {bookingState.hotel ? (
                <span className="status-tag booked-tag">✅ Booked</span>
              ) : (
                <span className="status-tag optional-tag">Optional</span>
              )}
              <span className="accordion-chevron">{openPanels.hotel ? '▲' : '▼'}</span>
            </div>
          </div>

          {openPanels.hotel && (
            <div className="accordion-body">
              {bookingState.hotel ? (
                <div className="booking-success-box">
                  <div className="success-icon">🎉</div>
                  <div className="success-details">
                    <h4>Hotel Reservation Confirmed!</h4>
                    <p>
                      <strong>{bookingState.hotel.hotelName}</strong> ({bookingState.hotel.roomType} room)
                    </p>
                    <p className="sub-info">
                      Dates: {bookingState.hotel.checkIn || 'Arrival'} to {bookingState.hotel.checkOut || 'Departure'} ·{' '}
                      Bed: {bookingState.hotel.bedPref} · {bookingState.hotel.smoking}
                    </p>
                    <p className="sub-info">
                      Total Cost: <strong>₹{bookingState.hotel.totalCost?.toLocaleString('en-IN')}</strong> ({bookingState.hotel.durationDays} nights)
                    </p>
                    {bookingState.hotel.specialReq && (
                      <p className="hub-badge">Note: "{bookingState.hotel.specialReq}"</p>
                    )}
                    <span className="booked-timestamp">Booked at {bookingState.hotel.bookedAt}</span>
                  </div>
                  <button
                    type="button"
                    className="modify-btn"
                    onClick={() => setBookingState((prev) => ({ ...prev, hotel: null }))}
                  >
                    Modify Hotel
                  </button>
                </div>
              ) : hotelBookingLoading ? (
                <div className="booking-processing-overlay">
                  <div className="processing-spinner" />
                  <p>Contacting hotel reservation system & reserving your room…</p>
                </div>
              ) : !targetHotel ? (
                <div className="no-selection-warning">
                  <p>⚠️ You haven't chosen a hotel yet in the Trip Planner.</p>
                  <p className="hint">You can go back to Step 2 to select your favorite hotel, or book one directly.</p>
                </div>
              ) : (
                <div className="form-content-grid">
                  {/* Selected Hotel Summary Card */}
                  <div className="selected-summary-banner">
                    <span className="summary-banner-icon">{targetHotel.icon || '🏨'}</span>
                    <div className="summary-banner-info">
                      <h4>{targetHotel.name}</h4>
                      <p>
                        ⭐ {targetHotel.rating || 4.5} · ₹{targetHotel.pricePerNight?.toLocaleString('en-IN')} / night ·{' '}
                        {targetHotel.address || cityName}
                      </p>
                    </div>
                  </div>

                  <div className="form-row">
                    <label>Select Room Preference</label>
                    <div className="room-preference-grid">
                      {ROOM_TYPES.map((rt) => (
                        <div
                          key={rt.id}
                          className={`room-option-card ${hotelRoomType === rt.id ? 'active' : ''}`}
                          onClick={() => setHotelRoomType(rt.id)}
                        >
                          <strong>{rt.label}</strong>
                          <span className="room-note">{rt.note}</span>
                          <span className="room-rate">
                            ₹{((targetHotel.pricePerNight || 3200) + rt.delta).toLocaleString('en-IN')}/night
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-row-multi">
                    <div className="form-col">
                      <label>Bed Configuration</label>
                      <select
                        value={hotelBedPref}
                        onChange={(e) => setHotelBedPref(e.target.value)}
                        className="primary-input"
                      >
                        {BED_PREFERENCES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-col">
                      <label>Smoking Preference</label>
                      <select
                        value={hotelSmoking}
                        onChange={(e) => setHotelSmoking(e.target.value)}
                        className="primary-input"
                      >
                        <option value="Non-Smoking">🚭 Non-Smoking Room (Guaranteed)</option>
                        <option value="Smoking Allowed">🚬 Smoking Room</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row-multi">
                    <div className="form-col">
                      <label>Check-in Date</label>
                      <input
                        type="date"
                        value={hotelCheckIn}
                        onChange={(e) => setHotelCheckIn(e.target.value)}
                        className="primary-input"
                      />
                    </div>
                    <div className="form-col">
                      <label>Check-out Date</label>
                      <input
                        type="date"
                        value={hotelCheckOut}
                        onChange={(e) => setHotelCheckOut(e.target.value)}
                        className="primary-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <label>Special Requests (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Quiet room away from elevator, early check-in, high floor, anniversary greeting..."
                      value={hotelSpecialReq}
                      onChange={(e) => setHotelSpecialReq(e.target.value)}
                      className="primary-input textarea"
                    />
                  </div>

                  <div className="hotel-price-summary-bar">
                    <div className="price-breakdown">
                      <span>₹{hotelRatePerNight.toLocaleString('en-IN')} / night × {trip.durationDays || 3} nights</span>
                      <strong>Total: ₹{hotelTotalCost.toLocaleString('en-IN')}</strong>
                    </div>
                    <button
                      type="button"
                      className="confirm-book-btn"
                      onClick={handleBookHotel}
                    >
                      🏨 Book Hotel Room
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 3. CAB SERVICE PANEL                                               */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className={`booking-accordion-card ${openPanels.cab ? 'expanded' : ''} ${bookingState.cab ? 'is-confirmed' : ''}`}>
          <div className="accordion-header" onClick={() => togglePanel('cab')}>
            <div className="header-left">
              <span className="accordion-icon">🚕</span>
              <div className="header-titles">
                <h3>3. Cab & Station Transfer</h3>
                <span className="header-preview-text">
                  {bookingState.cab
                    ? `Booked: ${bookingState.cab.cabName} (${bookingState.cab.pickupWanted ? 'Pickup Confirmed' : 'Self-drive'})`
                    : `Station / Airport to Hotel Transfer (${targetCab.name})`}
                </span>
              </div>
            </div>
            <div className="header-right">
              {bookingState.cab ? (
                <span className="status-tag booked-tag">✅ Booked</span>
              ) : (
                <span className="status-tag optional-tag">Optional</span>
              )}
              <span className="accordion-chevron">{openPanels.cab ? '▲' : '▼'}</span>
            </div>
          </div>

          {openPanels.cab && (
            <div className="accordion-body">
              {bookingState.cab ? (
                <div className="booking-success-box">
                  <div className="success-icon">🎉</div>
                  <div className="success-details">
                    <h4>Cab Transfer Service Confirmed!</h4>
                    <p>
                      <strong>{bookingState.cab.cabName}</strong>
                    </p>
                    {bookingState.cab.pickupWanted ? (
                      <p className="sub-info">
                        Pickup Point: <strong>{bookingState.cab.pickupPoint}</strong> ➔ Drop:{' '}
                        <strong>{bookingState.cab.dropPoint}</strong>
                        <br />
                        Scheduled Pickup Time: {bookingState.cab.pickupTime} · Luggage: {bookingState.cab.luggageCount} bags
                      </p>
                    ) : (
                      <p className="sub-info">Station transfer not requested (User opted for self-arrangement)</p>
                    )}
                    <span className="booked-timestamp">Booked at {bookingState.cab.bookedAt}</span>
                  </div>
                  <button
                    type="button"
                    className="modify-btn"
                    onClick={() => setBookingState((prev) => ({ ...prev, cab: null }))}
                  >
                    Modify Cab
                  </button>
                </div>
              ) : cabBookingLoading ? (
                <div className="booking-processing-overlay">
                  <div className="processing-spinner" />
                  <p>Assigning dedicated driver & scheduling your airport/station transfer…</p>
                </div>
              ) : (
                <div className="form-content-grid">
                  <div className="selected-summary-banner">
                    <span className="summary-banner-icon">{targetCab.icon || '🚕'}</span>
                    <div className="summary-banner-info">
                      <h4>{targetCab.name}</h4>
                      <p>Full Day Dedicated Chauffeur · Air Conditioned · Sanitized</p>
                    </div>
                  </div>

                  {/* Ask user if they want pick up from station and drop to hotel */}
                  <div className="form-row">
                    <label>Do you want the cab to pick you up from the station/airport and drop you at the hotel?</label>
                    <div className="yes-no-toggle-row">
                      <button
                        type="button"
                        className={`toggle-btn ${cabPickupWanted ? 'active' : ''}`}
                        onClick={() => setCabPickupWanted(true)}
                      >
                        ✓ Yes, pick me up from station & drop at hotel
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${!cabPickupWanted ? 'active' : ''}`}
                        onClick={() => setCabPickupWanted(false)}
                      >
                        ✕ No, I will arrange my own transit
                      </button>
                    </div>
                  </div>

                  {cabPickupWanted && (
                    <>
                      <div className="transit-route-preview-card">
                        <div className="route-step">
                          <span className="step-dot origin">●</span>
                          <div className="step-info">
                            <span className="step-type">Pickup Location</span>
                            <strong>{destinationHub.name}</strong>
                          </div>
                        </div>
                        <div className="route-arrow-down">↓ Direct Highway Transfer</div>
                        <div className="route-step">
                          <span className="step-dot destination">●</span>
                          <div className="step-info">
                            <span className="step-type">Drop-off Location</span>
                            <strong>{targetHotel?.name || `${cityName} City Hotel`}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="form-row-multi">
                        <div className="form-col">
                          <label>Expected Arrival Time at Station/Airport</label>
                          <input
                            type="time"
                            value={cabPickupTime}
                            onChange={(e) => setCabPickupTime(e.target.value)}
                            className="primary-input"
                          />
                        </div>
                        <div className="form-col">
                          <label>Train / Flight Number (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. 12658 / 6E-408 for live delay tracking"
                            value={cabFlightOrTrainNo}
                            onChange={(e) => setCabFlightOrTrainNo(e.target.value)}
                            className="primary-input"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <label>Luggage / Bags Count</label>
                        <div className="travellers-stepper">
                          <button
                            type="button"
                            onClick={() => setCabLuggageCount((v) => Math.max(1, v - 1))}
                          >
                            −
                          </button>
                          <span>{cabLuggageCount} Bags</span>
                          <button
                            type="button"
                            onClick={() => setCabLuggageCount((v) => Math.min(10, v + 1))}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="hotel-price-summary-bar">
                    <div className="price-breakdown">
                      <span>All-inclusive transfer fare</span>
                      <strong>₹{(targetCab.fare || 2800).toLocaleString('en-IN')}</strong>
                    </div>
                    <button
                      type="button"
                      className="confirm-book-btn"
                      onClick={handleBookCab}
                    >
                      🚕 Book Cab Service
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 4. TOURIST PLACES PANEL                                            */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className={`booking-accordion-card ${openPanels.places ? 'expanded' : ''} ${bookingState.places ? 'is-confirmed' : ''}`}>
          <div className="accordion-header" onClick={() => togglePanel('places')}>
            <div className="header-left">
              <span className="accordion-icon">🎟️</span>
              <div className="header-titles">
                <h3>4. Tourist Places Entry Tickets</h3>
                <span className="header-preview-text">
                  {bookingState.places
                    ? `Booked: ${bookingState.places.count} Attraction Tickets (₹${bookingState.places.totalCost?.toLocaleString('en-IN')})`
                    : `Pre-book skip-the-line tickets for your ${trip.selectedAttractions.length} selected spots`}
                </span>
              </div>
            </div>
            <div className="header-right">
              {bookingState.places ? (
                <span className="status-tag booked-tag">✅ Booked</span>
              ) : (
                <span className="status-tag optional-tag">Optional</span>
              )}
              <span className="accordion-chevron">{openPanels.places ? '▲' : '▼'}</span>
            </div>
          </div>

          {openPanels.places && (
            <div className="accordion-body">
              {bookingState.places ? (
                <div className="booking-success-box">
                  <div className="success-icon">🎉</div>
                  <div className="success-details">
                    <h4>Entry Tickets Confirmed & Issued!</h4>
                    <p>
                      <strong>{bookingState.places.count} Attractions Confirmed</strong> · Skip-the-line digital QR passes
                    </p>
                    <p className="sub-info">
                      Total Tickets Amount: <strong>₹{bookingState.places.totalCost?.toLocaleString('en-IN')}</strong>
                    </p>
                    <span className="booked-timestamp">Booked at {bookingState.places.bookedAt}</span>
                  </div>
                  <button
                    type="button"
                    className="modify-btn"
                    onClick={() => setBookingState((prev) => ({ ...prev, places: null }))}
                  >
                    Modify Tickets
                  </button>
                </div>
              ) : placesBookingLoading ? (
                <div className="booking-processing-overlay">
                  <div className="processing-spinner" />
                  <p>Generating digital passes and reserving fast-track access…</p>
                </div>
              ) : Object.keys(placesTickets).length === 0 ? (
                <div className="no-selection-warning">
                  <p>⚠️ No tourist spots selected in your trip yet.</p>
                  <p className="hint">You can go back to Step 1 to add sights to your itinerary!</p>
                </div>
              ) : (
                <div className="form-content-grid">
                  <p className="section-instructions">
                    Select which attractions you would like tickets for, choose visiting time slots, and optional verified audio/local guide.
                  </p>

                  <div className="tickets-custom-list">
                    {Object.entries(placesTickets).map(([key, item]) => (
                      <div
                        key={key}
                        className={`ticket-entry-row ${item.selected ? 'active' : 'disabled'}`}
                      >
                        <div className="ticket-row-left">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() =>
                              setPlacesTickets((prev) => ({
                                ...prev,
                                [key]: { ...prev[key], selected: !prev[key].selected },
                              }))
                            }
                            className="ticket-checkbox"
                          />
                          <span className="ticket-icon">{item.icon}</span>
                          <div className="ticket-text">
                            <strong>{item.name}</strong>
                            <span className="ticket-category-tag">{item.category}</span>
                          </div>
                        </div>

                        {item.selected && (
                          <div className="ticket-row-right">
                            {item.isFree ? (
                              <span className="free-entry-badge">Free Entry (No Ticket Required)</span>
                            ) : (
                              <div className="ticket-stepper-box">
                                <span className="price-per-ticket">₹{item.price} / ticket</span>
                                <div className="travellers-stepper small">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPlacesTickets((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...prev[key],
                                          visitors: Math.max(1, prev[key].visitors - 1),
                                        },
                                      }))
                                    }
                                  >
                                    −
                                  </button>
                                  <span>{item.visitors}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPlacesTickets((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...prev[key],
                                          visitors: Math.min(20, prev[key].visitors + 1),
                                        },
                                      }))
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="ticket-row-subtotal">
                                  ₹{(item.price * item.visitors).toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}

                            {/* Slot and Guide Options */}
                            <div className="cliche-addons-row">
                              <select
                                value={item.timeSlot}
                                onChange={(e) =>
                                  setPlacesTickets((prev) => ({
                                    ...prev,
                                    [key]: { ...prev[key], timeSlot: e.target.value },
                                  }))
                                }
                                className="slot-select"
                              >
                                {TIME_SLOTS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>

                              <label className="guide-toggle-label">
                                <input
                                  type="checkbox"
                                  checked={item.needGuide}
                                  onChange={(e) =>
                                    setPlacesTickets((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], needGuide: e.target.checked },
                                    }))
                                  }
                                />
                                <span>Local Audio/Expert Guide (+₹400)</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="hotel-price-summary-bar">
                    <div className="price-breakdown">
                      <span>{selectedPlacesCount} Attractions Selected</span>
                      <strong>Total: ₹{placesTotalCost.toLocaleString('en-IN')}</strong>
                    </div>
                    <button
                      type="button"
                      className="confirm-book-btn"
                      onClick={handleBookPlaces}
                      disabled={selectedPlacesCount === 0}
                    >
                      🎟️ Confirm Tourist Places Tickets
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* 5. RETURN PANEL (Places reversed from Arrival)                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div className={`booking-accordion-card ${openPanels.return ? 'expanded' : ''} ${bookingState.return ? 'is-confirmed' : ''}`}>
          <div className="accordion-header" onClick={() => togglePanel('return')}>
            <div className="header-left">
              <span className="accordion-icon">🔁</span>
              <div className="header-titles">
                <h3>5. Return Journey ({returnFromCity} ➔ {retToCity || 'Home'})</h3>
                <span className="header-preview-text">
                  {bookingState.return
                    ? `Booked: ${bookingState.return.selectedOption?.operator} (${bookingState.return.mode.toUpperCase()}) to ${bookingState.return.destination}`
                    : `Travel back from ${returnFromCity} to ${retToCity || 'your city'}`}
                </span>
              </div>
            </div>
            <div className="header-right">
              {bookingState.return ? (
                <span className="status-tag booked-tag">✅ Booked</span>
              ) : (
                <span className="status-tag optional-tag">Optional</span>
              )}
              <span className="accordion-chevron">{openPanels.return ? '▲' : '▼'}</span>
            </div>
          </div>

          {openPanels.return && (
            <div className="accordion-body">
              {bookingState.return ? (
                <div className="booking-success-box">
                  <div className="success-icon">🎉</div>
                  <div className="success-details">
                    <h4>Return Journey Confirmed & Booked!</h4>
                    <p>
                      <strong>{bookingState.return.selectedOption?.tier} Tier</strong> ·{' '}
                      {bookingState.return.selectedOption?.operator} ({bookingState.return.selectedOption?.code})
                    </p>
                    <p className="sub-info">
                      Route: {bookingState.return.origin} ➔ {bookingState.return.destination} ·{' '}
                      Date: {bookingState.return.date || 'Flexible'} · Travellers: {bookingState.return.travellers}
                    </p>
                    <span className="booked-timestamp">Booked at {bookingState.return.bookedAt}</span>
                  </div>
                  <button
                    type="button"
                    className="modify-btn"
                    onClick={() => setBookingState((prev) => ({ ...prev, return: null }))}
                  >
                    Modify Return
                  </button>
                </div>
              ) : retBookingLoading ? (
                <div className="booking-processing-overlay">
                  <div className="processing-spinner" />
                  <p>Booking return tickets and securing your seats…</p>
                </div>
              ) : (
                <div className="form-content-grid">
                  <div className="form-row-multi">
                    <div className="form-col">
                      <label>Departing From (Fixed)</label>
                      <input
                        type="text"
                        value={returnFromCity}
                        disabled
                        className="primary-input readonly"
                      />
                    </div>
                    <div className="form-col">
                      <label>Going Back To (Reversed Origin)</label>
                      <input
                        type="text"
                        placeholder="e.g. Mumbai, New Delhi..."
                        value={retToCity}
                        onChange={(e) => setRetToCity(e.target.value)}
                        className="primary-input"
                      />
                    </div>
                  </div>

                  <div className="form-row-multi">
                    <div className="form-col">
                      <label>Return Date</label>
                      <input
                        type="date"
                        value={retDate}
                        onChange={(e) => setRetDate(e.target.value)}
                        className="primary-input"
                      />
                    </div>
                    <div className="form-col">
                      <label>Number of Travellers</label>
                      <div className="travellers-stepper">
                        <button
                          type="button"
                          onClick={() => setRetTravellers((v) => Math.max(1, v - 1))}
                        >
                          −
                        </button>
                        <span>{retTravellers}</span>
                        <button
                          type="button"
                          onClick={() => setRetTravellers((v) => Math.min(20, v + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <label>Preferred Mode of Return Travel</label>
                    <div className="mode-selection-pills">
                      {MODE_OPTIONS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`mode-pill ${retMode === m.id ? 'active' : ''}`}
                          onClick={() => {
                            setRetMode(m.id);
                            setRetSearchResults(null);
                            setRetSelectedIdx(null);
                          }}
                        >
                          <span className="pill-icon">{m.icon}</span>
                          <span className="pill-label">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="action-btn-row">
                    <button
                      type="button"
                      className="search-service-btn"
                      onClick={handleSearchReturn}
                      disabled={!retToCity.trim() || retSearchLoading}
                    >
                      {retSearchLoading ? '🔍 Querying Return Schedules…' : `🔍 Search Return ${retMode.toUpperCase()} Options`}
                    </button>
                  </div>

                  {/* Return Search Results with Budget, Comfort, Premium */}
                  {retSearchResults && (
                    <div className="results-showcase-section">
                      <h4>Return Options from {returnFromCity} to {retToCity}:</h4>
                      <div className="tier-cards-grid">
                        {retSearchResults.map((res, idx) => (
                          <div
                            key={idx}
                            className={`tier-card ${res.tier.toLowerCase()} ${retSelectedIdx === idx ? 'selected' : ''}`}
                            onClick={() => setRetSelectedIdx(idx)}
                          >
                            <div className="tier-card-header">
                              <span className="tier-tag">
                                {res.tierIcon} {res.tier}
                              </span>
                              <span className="tier-badge-label">{res.tierBadge}</span>
                            </div>
                            <div className="tier-card-operator">
                              <strong>{res.operator}</strong>
                              <span className="operator-code">{res.code}</span>
                            </div>
                            <div className="tier-timings">
                              <span className="time-dep">{res.depTime}</span>
                              <span className="time-arrow">➔</span>
                              <span className="time-arr">{res.arrTime}</span>
                              <span className="time-dur">({res.duration})</span>
                            </div>
                            <ul className="tier-features-list">
                              {res.features.map((f, i) => (
                                <li key={i}>✓ {f}</li>
                              ))}
                            </ul>
                            <div className="tier-card-footer">
                              <span className="price-total">₹{res.total.toLocaleString('en-IN')}</span>
                              <span className="price-per-person">₹{res.perPerson}/person</span>
                            </div>
                            <button
                              type="button"
                              className={`select-tier-btn ${retSelectedIdx === idx ? 'active' : ''}`}
                            >
                              {retSelectedIdx === idx ? '✓ Selected' : 'Choose Option'}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="confirm-booking-row">
                        <button
                          type="button"
                          className="confirm-book-btn"
                          onClick={handleBookReturn}
                          disabled={retSelectedIdx === null}
                        >
                          🔁 Book Selected Return Option
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Booking Flow Bottom Sticky Bar */}
      <div className="booking-flow-bottombar">
        <div className="bottombar-info">
          <span className="bottombar-icon">✨</span>
          <div>
            <strong>{bookedSectionsCount} of 5 services booked</strong>
            <p>Your bookings are stored and ready for your visit to {cityName}.</p>
          </div>
        </div>
        <button type="button" className="booking-done-btn" onClick={onBack}>
          ← Return to Dashboard
        </button>
      </div>
    </div>
  );
}
