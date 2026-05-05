import React, { useState, useMemo } from 'react';
import RestaurantCard from './RestaurantCard';
import styles from './RestaurantList.module.css';

const SORT_OPTIONS = [
  { value: 'rating',     label: '⭐ Rating',       icon: '⭐' },
  { value: 'distance',   label: '📍 Distance',     icon: '📍' },
  { value: 'price_asc',  label: '💰 Price: Low→High', icon: '💰' },
  { value: 'price_desc', label: '💰 Price: High→Low', icon: '💰' },
];

const CUISINE_TAGS = [
  { value: 'sushi',       label: '🍣 Sushi',      keywords: ['sushi', 'japanese'] },
  { value: 'bbq',         label: '🥩 BBQ',        keywords: ['bbq', 'barbecue', 'korean', 'grill'] },
  { value: 'chinese',     label: '🥢 Chinese',    keywords: ['chinese'] },
  { value: 'italian',     label: '🍝 Italian',    keywords: ['italian', 'pizza'] },
  { value: 'mexican',     label: '🌮 Mexican',    keywords: ['mexican'] },
  { value: 'indian',      label: '🍛 Indian',     keywords: ['indian'] },
  { value: 'thai',        label: '🍜 Thai',       keywords: ['thai'] },
  { value: 'burger',      label: '🍔 Burger',     keywords: ['burger', 'american', 'fast_food'] },
  { value: 'seafood',     label: '🦞 Seafood',    keywords: ['seafood'] },
  { value: 'cafe',        label: '☕ Café',        keywords: ['cafe', 'coffee', 'bakery'] },
  { value: 'vegetarian',  label: '🥗 Vegetarian', keywords: ['vegetarian', 'vegan'] },
  { value: 'ramen',       label: '🍜 Ramen',      keywords: ['ramen', 'noodle'] },
];

export default function RestaurantList({ restaurants, userLocation, onSelect, onSearchMap, allergens }) {
  const [sortBy, setSortBy]           = useState('rating');
  const [filterOpen, setFilterOpen]   = useState(false);
  const [filterParking, setFilterParking] = useState(false);
  const [selectedCuisines, setSelectedCuisines] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const toggleCuisine = (value) => {
    setSelectedCuisines((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const clearAll = () => {
    setSortBy('rating');
    setFilterOpen(false);
    setFilterParking(false);
    setSelectedCuisines([]);
  };

  const activeFilterCount =
    (filterOpen ? 1 : 0) +
    (filterParking ? 1 : 0) +
    selectedCuisines.length +
    (sortBy !== 'rating' ? 1 : 0);

  const filtered = useMemo(() => {
    let list = [...restaurants];

    // Open now
    if (filterOpen) list = list.filter((r) => r.openNow);

    // Parking — Places API returns hasParking on detail fetch,
    // but nearby search doesn't include it, so we skip silently if undefined
    if (filterParking) list = list.filter((r) => r.hasParking === true);

    // Cuisine tags
    if (selectedCuisines.length > 0) {
      list = list.filter((r) => {
        const typeStr = (r.types || []).join(' ').toLowerCase();
        const nameStr = r.name.toLowerCase();
        return selectedCuisines.some((cuisine) => {
          const tag = CUISINE_TAGS.find((t) => t.value === cuisine);
          return tag?.keywords.some((kw) => typeStr.includes(kw) || nameStr.includes(kw));
        });
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'rating')     return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === 'price_asc')  return (a.priceLevel ?? 99) - (b.priceLevel ?? 99);
      if (sortBy === 'price_desc') return (b.priceLevel ?? 0) - (a.priceLevel ?? 0);
      if (sortBy === 'distance' && userLocation) {
        return getDistance(userLocation, a.location) - getDistance(userLocation, b.location);
      }
      return 0;
    });

    return list;
  }, [restaurants, sortBy, filterOpen, filterParking, selectedCuisines, userLocation]);

  if (restaurants.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyIcon}>🍽️</p>
        <p>No restaurants found yet.</p>
        <button className={styles.goMapBtn} onClick={onSearchMap}>
          Go to Map &amp; Search
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {filtered.length} <span className={styles.countOf}>/ {restaurants.length}</span>
        </span>

        <div className={styles.toolbarRight}>
          {/* Sort dropdown */}
          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort restaurants"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Filter toggle */}
          <button
            className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-label="Toggle filters"
          >
            🎛 Filters
            {activeFilterCount > 0 && (
              <span className={styles.filterBadge}>{activeFilterCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className={styles.filterPanel}>
          {/* Quick toggles */}
          <div className={styles.filterRow}>
            <button
              className={`${styles.chip} ${filterOpen ? styles.chipActive : ''}`}
              onClick={() => setFilterOpen(!filterOpen)}
              aria-pressed={filterOpen}
            >
              🟢 Open Now
            </button>
            <button
              className={`${styles.chip} ${filterParking ? styles.chipActive : ''}`}
              onClick={() => setFilterParking(!filterParking)}
              aria-pressed={filterParking}
            >
              🅿️ Parking
            </button>
          </div>

          {/* Cuisine tags */}
          <p className={styles.filterLabel}>Cuisine</p>
          <div className={styles.cuisineGrid}>
            {CUISINE_TAGS.map((tag) => (
              <button
                key={tag.value}
                className={`${styles.chip} ${selectedCuisines.includes(tag.value) ? styles.chipActive : ''}`}
                onClick={() => toggleCuisine(tag.value)}
                aria-pressed={selectedCuisines.includes(tag.value)}
              >
                {tag.label}
              </button>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <button className={styles.clearBtn} onClick={clearAll}>
              ✕ Clear all filters
            </button>
          )}
        </div>
      )}

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div className={styles.noMatch}>
          <p>No restaurants match your filters.</p>
          <button className={styles.clearBtn} onClick={clearAll}>Clear filters</button>
        </div>
      ) : (
        <ul className={styles.list} aria-label="Restaurant list">
          {filtered.map((r) => (
            <li key={r.id}>
              <RestaurantCard
                restaurant={r}
                userLocation={userLocation}
                onClick={() => onSelect(r)}
                allergens={allergens}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
