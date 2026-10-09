import React, { useEffect, useState } from "react";
import { fetchWeatherApi } from "openmeteo";

function decodeWeatherCode(code) {
  if (code === 0) return { label: "Clear Sky", icon: "☀️" };
  if (code === 1) return { label: "Mainly Clear", icon: "🌤️" };
  if (code === 2) return { label: "Partly Cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "🌫️" };
  if (code >= 51 && code <= 55) return { label: "Light Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 65) return { label: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { label: "Rain Showers", icon: "🌧️" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "Mild Conditions", icon: "🌤️" };
}

function getWeatherAdvice(temp, precip, code) {
  const isRainy = precip > 0 || (code >= 51 && code <= 65) || (code >= 80 && code <= 82) || code >= 95;
  const isCold = temp < 10;
  const isHot = temp > 32;

  // Clothing advice
  let clothes = "Breathable cotton t-shirts, light trousers, comfortable attire";
  if (temp < 8) {
    clothes = "Heavy winter coat, thermal innerwear, gloves and warm scarf";
  } else if (temp < 16) {
    clothes = "Warm sweater, fleece jacket, jeans and comfortable layering";
  } else if (temp > 28) {
    clothes = "Lightweight linen, loose cotton clothes, shorts and airy apparel";
  }

  // Necessary items
  const items = [];
  if (isRainy) {
    items.push("Compact travel umbrella");
    items.push("Waterproof bag or rain cover");
  } else if (temp > 22 || code <= 2) {
    items.push("Sunscreen SPF 50+");
    items.push("UV Sunglasses and sun hat");
  }
  items.push("Comfortable walking shoes");
  items.push("Refillable water bottle");

  // Visiting assessment: Best / Good / Bad (Challenging)
  let rating = {
    badge: "🌟 Best Time to Visit",
    level: "best",
    text: "Great weather conditions with comfortable temperatures for outdoor sightseeing!",
  };

  if (isRainy && precip > 4) {
    rating = {
      badge: "⚠️ Challenging Time to Visit",
      level: "bad",
      text: "Expect rain spells and overcast skies. Keep indoor attractions and rain gear handy.",
    };
  } else if (isHot) {
    rating = {
      badge: "☀️ Warm Weather",
      level: "caution",
      text: "Hot temperatures during midday. Plan outdoor monuments early morning or evening.",
    };
  } else if (isCold) {
    rating = {
      badge: "❄️ Chilly Weather",
      level: "caution",
      text: "Cold temperatures. Bundle up warmly to enjoy sightseeing comfortably.",
    };
  } else if (isRainy || temp > 28 || temp < 15) {
    rating = {
      badge: "👍 Good Time to Visit",
      level: "good",
      text: "Generally favorable travel conditions with manageable seasonal variations.",
    };
  }

  return { clothes, items: items.join(" · "), rating };
}

export default function WeatherBanner({ destination, onWeatherChange }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!destination || typeof destination.lat !== "number" || typeof destination.lon !== "number") {
      return;
    }

    async function loadWeather() {
      setLoading(true);
      setError(false);
      try {
        const params = {
          latitude: destination.lat,
          longitude: destination.lon,
          current: ["temperature_2m", "relative_humidity_2m", "precipitation", "weather_code", "wind_speed_10m"],
          hourly: "temperature_2m",
        };
        const url = "https://api.open-meteo.com/v1/forecast";
        const responses = await fetchWeatherApi(url, params);

        if (cancelled || !responses || !responses.length) return;

        const response = responses[0];
        const current = response.current();

        const temp = Math.round(current.variables(0).value());
        const humidity = Math.round(current.variables(1).value());
        const precip = Math.round(current.variables(2).value() * 10) / 10;
        const code = Math.round(current.variables(3).value());
        const wind = Math.round(current.variables(4).value());

        const condition = decodeWeatherCode(code);
        const advice = getWeatherAdvice(temp, precip, code);

        const weatherData = {
          temp,
          humidity,
          precip,
          wind,
          condition,
          advice,
        };

        setWeather(weatherData);
        if (onWeatherChange) onWeatherChange(weatherData);
      } catch (err) {
        console.warn("[weather] Unable to fetch Open-Meteo weather:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWeather();
    return () => {
      cancelled = true;
    };
  }, [destination?.lat, destination?.lon]);

  if (loading) {
    return (
      <div className="weather-banner weather-banner-loading">
        <span className="weather-loading-icon">🌤️</span>
        <span className="weather-loading-text">Fetching live destination weather…</span>
      </div>
    );
  }

  if (error || !weather) return null;

  const cityName = destination.displayName?.split(",")[0] || "Destination";

  return (
    <div className="weather-banner-wrapper">
      <div className="weather-banner-main">
        {/* Left Col: Current Weather Stats */}
        <div className="weather-stat-block">
          <div className="weather-stat-headline">
            <span className="weather-condition-icon">{weather.condition.icon}</span>
            <div className="weather-temp-info">
              <div className="weather-temp-number">{weather.temp}°C</div>
              <div className="weather-condition-label">
                {weather.condition.label} in {cityName}
              </div>
            </div>
          </div>
          <div className="weather-meta-tags">
            <span className="weather-tag">💧 Humidity: {weather.humidity}%</span>
            {weather.precip > 0 && <span className="weather-tag rain">🌧️ Rain: {weather.precip} mm</span>}
            <span className="weather-tag">💨 Wind: {weather.wind} km/h</span>
          </div>
        </div>

        {/* Center Col: Clothing & Necessary Items */}
        <div className="weather-recommendations-block">
          <div className="weather-rec-row">
            <span className="rec-title">👕 Clothes to Carry:</span>
            <span className="rec-detail">{weather.advice.clothes}</span>
          </div>
          <div className="weather-rec-row">
            <span className="rec-title">🎒 Must Bring:</span>
            <span className="rec-detail">{weather.advice.items}</span>
          </div>
        </div>

        {/* Right Col: Travel Advice Badge */}
        <div className="weather-advice-block">
          <div className={`weather-rating-pill ${weather.advice.rating.level}`}>
            {weather.advice.rating.badge}
          </div>
          <p className="weather-advice-caption">{weather.advice.rating.text}</p>
        </div>
      </div>
    </div>
  );
}

