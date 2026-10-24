import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'srms:';

/**
 * useState + localStorage.
 *
 * Assignment 1 keeps the data in the browser so every feature (cart, orders, reservations, admin
 * CRUD) survives a page refresh. The signature deliberately matches useState so that in Assignment 2
 * we can swap this hook for a data-fetching hook backed by the Express API without touching the
 * components.
 */
export default function usePersistentState(key, initialValue) {
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return initialValue;
      return JSON.parse(raw);
    } catch (error) {
      // Corrupted or unavailable storage: fall back to the initial value instead of crashing.
      console.warn(`usePersistentState: could not read "${key}"`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.warn(`usePersistentState: could not save "${key}"`, error);
    }
  }, [storageKey, key, value]);

  return [value, setValue];
}
