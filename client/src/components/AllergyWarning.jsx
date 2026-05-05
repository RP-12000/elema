import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import styles from './AllergyWarning.module.css';

// Cache results so we don't re-call for the same restaurant + allergen combo
const cache = new Map();

function cacheKey(types, allergens) {
  return `${types.sort().join(',')}|${allergens.sort().join(',')}`;
}

export default function AllergyWarning({ cuisineTypes = [], allergens = [] }) {
  const [result, setResult] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!allergens.length || !cuisineTypes.length) {
      setResult(null);
      return;
    }

    const key = cacheKey(cuisineTypes, allergens);
    if (cache.has(key)) {
      setResult(cache.get(key));
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await axios.post('/api/allergy/check', {
          cuisineTypes,
          allergens,
        });
        cache.set(key, data);
        if (mountedRef.current) setResult(data);
      } catch {
        // silently fail
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cuisineTypes.join(','), allergens.join(',')]);

  if (!result || result.risk === 'none') return null;

  const isHigh = result.risk === 'high';

  return (
    <div
      className={`${styles.wrapper} ${isHigh ? styles.wrapperHigh : styles.wrapperLow}`}
      aria-label={`Allergy warning: ${result.warnings.join('. ')}`}
    >
      <span className={`${styles.badge} ${isHigh ? styles.badgeHigh : styles.badgeLow}`}>
        {isHigh ? 'High Allergy Risk' : 'Possible Allergy Risk'}
      </span>
      {result.warnings.length > 0 && (
        <ul className={styles.warningList}>
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
