import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styles from './RestaurantDetail.module.css';

const PRICE_LABELS = ['Free', '$', '$$', '$$$', '$$$$'];

export default function RestaurantDetail({ restaurant, userLocation, onBack, onNavigate }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get(`/api/places/details/${restaurant.id}`)
      .then(({ data }) => setDetails(data))
      .catch(() => setError('Failed to load details.'))
      .finally(() => setLoading(false));
  }, [restaurant.id]);

  const handleNavigate = () => {
    onNavigate?.({ location: restaurant.location, name: restaurant.name });
  };

  return (
    <div className={styles.container}>
      <button className={styles.back} onClick={onBack} aria-label="Back to list">
        ← Back
      </button>

      <div className={styles.header}>
        <h2 className={styles.name}>{restaurant.name}</h2>
        <div className={styles.badges}>
          {restaurant.rating != null && (
            <span className={styles.badge}>⭐ {restaurant.rating.toFixed(1)}</span>
          )}
          {restaurant.priceLevel != null && (
            <span className={styles.badge}>{PRICE_LABELS[restaurant.priceLevel]}</span>
          )}
          <span className={`${styles.badge} ${restaurant.openNow ? styles.open : styles.closed}`}>
            {restaurant.openNow ? '🟢 Open' : '🔴 Closed'}
          </span>
        </div>
      </div>

      <button className={styles.navBtn} onClick={handleNavigate} aria-label="Navigate to restaurant">
        🧭 Navigate Here
      </button>

      {loading && <p className={styles.loading}>Loading details...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {details && (
        <div className={styles.details}>
          {/* Address */}
          <Section title="📍 Address">
            <p>{details.address}</p>
            {details.phone && <p>📞 {details.phone}</p>}
            {details.website && (
              <a href={details.website} target="_blank" rel="noopener noreferrer" className={styles.link}>
                🌐 Website
              </a>
            )}
          </Section>

          {/* Parking */}
          <Section title="🅿️ Parking">
            <p>{details.hasParking ? '✅ Parking available nearby' : 'ℹ️ No dedicated parking info'}</p>
          </Section>

          {/* Opening Hours */}
          {details.openingHours.length > 0 && (
            <Section title="🕐 Opening Hours">
              <ul className={styles.hours}>
                {details.openingHours.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Cuisine / Type */}
          <Section title="🍽️ Type">
            <p>{formatTypes(details.types)}</p>
          </Section>

          {/* Reviews */}
          {details.reviews.length > 0 && (
            <Section title="💬 Reviews">
              {details.reviews.map((r, i) => (
                <div key={i} className={styles.review}>
                  <div className={styles.reviewHeader}>
                    <strong>{r.author}</strong>
                    <span>{'⭐'.repeat(r.rating)}</span>
                    <span className={styles.reviewTime}>{r.time}</span>
                  </div>
                  <p className={styles.reviewText}>{r.text}</p>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
      <div style={{ fontSize: 'var(--fs-md)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function formatTypes(types = []) {
  return types
    .filter((t) => !['point_of_interest', 'establishment', 'food'].includes(t))
    .map((t) => t.replace(/_/g, ' '))
    .join(', ') || 'Restaurant';
}
