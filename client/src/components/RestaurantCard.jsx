import React from 'react';
import AllergyWarning from './AllergyWarning';
import styles from './RestaurantCard.module.css';

const PRICE_LABELS = ['Free', '$', '$$', '$$$', '$$$$'];

export default function RestaurantCard({ restaurant, userLocation, onClick, allergens }) {
  const { name, rating, userRatingsTotal, priceLevel, vicinity, openNow, types, location } = restaurant;

  const distance = userLocation ? formatDistance(getDistance(userLocation, location)) : null;
  const cuisine  = getCuisine(types);
  const price    = priceLevel != null ? PRICE_LABELS[priceLevel] : 'N/A';

  return (
    <button
      className={styles.card}
      onClick={onClick}
      aria-label={`${name}, ${rating} stars, ${price}, ${openNow ? 'open' : 'closed'}`}
    >
      <div className={styles.body}>
        <div className={styles.top}>
          <h3 className={styles.name}>{name}</h3>
          <span className={`${styles.status} ${openNow ? styles.open : styles.closed}`}>
            {openNow ? 'Open' : 'Closed'}
          </span>
        </div>

        <div className={styles.meta}>
          {rating != null && (
            <span className={styles.rating}>
              ⭐ {rating.toFixed(1)}
              {userRatingsTotal && <span className={styles.ratingCount}> ({userRatingsTotal})</span>}
            </span>
          )}
          <span className={styles.price}>{price}</span>
          {cuisine && <span className={styles.cuisine}>{cuisine}</span>}
          {/* Allergy warning — only renders if allergens are set and risk > none */}
          {allergens?.length > 0 && (
            <AllergyWarning cuisineTypes={types} allergens={allergens} />
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.address}>📍 {vicinity}</span>
          {distance && <span className={styles.distance}>{distance}</span>}
        </div>
      </div>
      <span className={styles.arrow} aria-hidden="true">›</span>
    </button>
  );
}

function getCuisine(types = []) {
  const map = {
    japanese_restaurant:  '🍣 Japanese',
    chinese_restaurant:   '🥢 Chinese',
    italian_restaurant:   '🍝 Italian',
    mexican_restaurant:   '🌮 Mexican',
    indian_restaurant:    '🍛 Indian',
    thai_restaurant:      '🍜 Thai',
    american_restaurant:  '🍔 American',
    pizza_restaurant:     '🍕 Pizza',
    seafood_restaurant:   '🦞 Seafood',
    vegetarian_restaurant:'🥗 Vegetarian',
    fast_food_restaurant: '🍟 Fast Food',
    cafe:                 '☕ Café',
    bakery:               '🥐 Bakery',
    bar:                  '🍺 Bar',
  };
  for (const t of types) { if (map[t]) return map[t]; }
  return '🍽️ Restaurant';
}

function getDistance(from, to) {
  const R = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
