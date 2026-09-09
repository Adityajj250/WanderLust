import React from "react";

export default function HotelCard({ hotel, isSelected, onSelect }) {
  return (
    <div className={`card hotel-card ${isSelected ? "selected" : ""}`}>
      {hotel.imageUrl && <img src={hotel.imageUrl} alt={hotel.name} className="card-image" loading="lazy" />}
      <div className="card-body">
        <div className="card-title-row">
          <h4>{hotel.name}</h4>
          <span className="rating">⭐ {hotel.rating}</span>
        </div>
        <p className="card-description">{hotel.address}</p>
        <p className="price">₹{hotel.pricePerNight?.toLocaleString("en-IN")} / night</p>

        {hotel.amenities?.length > 0 && (
          <div className="amenities">
            {hotel.amenities.map((a) => (
              <span key={a} className="chip small">{a}</span>
            ))}
          </div>
        )}

        <div className="hotel-actions">
          <button className="secondary" onClick={() => onSelect(hotel)}>
            {isSelected ? "Selected ✓" : "View distances"}
          </button>
          <a
            className="book-btn"
            href={hotel.bookingUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Book Now
          </a>
        </div>
      </div>
    </div>
  );
}
