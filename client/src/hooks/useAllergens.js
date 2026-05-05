import { useState, useEffect } from 'react';

const STORAGE_KEY = 'rf_allergens';

export function useAllergens() {
  const [allergens, setAllergens] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allergens));
  }, [allergens]);

  const addAllergen = (item) => {
    const clean = item.trim().toLowerCase();
    if (!clean || allergens.includes(clean)) return;
    setAllergens((prev) => [...prev, clean]);
  };

  const removeAllergen = (item) => {
    setAllergens((prev) => prev.filter((a) => a !== item));
  };

  const clearAll = () => setAllergens([]);

  return { allergens, addAllergen, removeAllergen, clearAll };
}
