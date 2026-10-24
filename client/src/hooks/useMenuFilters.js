import { useMemo, useState } from 'react';

const INITIAL_FILTERS = {
  search: '',
  category: 'all',
  dietary: [],
  minPrice: '',
  maxPrice: '',
  sort: 'default',
  availableOnly: false,
  favouritesOnly: false,
};

/**
 * Custom hook that owns the menu filtering state and derives the visible list with useMemo.
 * Keeping this out of the page component makes the page easy to read and the filtering reusable
 * (the AI assistant uses the same matching rules through services/aiAssistant.js).
 */
export default function useMenuFilters(items, favouriteIds = []) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const results = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();

    let list = items.filter((item) => {
      if (filters.category !== 'all' && item.category !== filters.category) return false;

      if (filters.availableOnly && !item.available) return false;

      if (filters.favouritesOnly && !favouriteIds.includes(item.id)) return false;

      if (
        filters.dietary.length > 0 &&
        !filters.dietary.every((tag) => item.dietary.includes(tag))
      ) {
        return false;
      }

      if (filters.minPrice !== '' && item.price < Number(filters.minPrice)) return false;
      if (filters.maxPrice !== '' && item.price > Number(filters.maxPrice)) return false;

      if (needle) {
        const haystack = [item.name, item.description, item.category, item.ingredients.join(' ')]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });

    switch (filters.sort) {
      case 'price-asc':
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case 'name':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'popular':
        list = [...list].sort((a, b) => Number(b.popular) - Number(a.popular));
        break;
      default:
        break;
    }

    return list;
  }, [items, filters, favouriteIds]);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleDietary = (tag) =>
    setFilters((prev) => ({
      ...prev,
      dietary: prev.dietary.includes(tag)
        ? prev.dietary.filter((t) => t !== tag)
        : [...prev.dietary, tag],
    }));

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.category !== 'all' ? 1 : 0) +
    filters.dietary.length +
    (filters.minPrice !== '' ? 1 : 0) +
    (filters.maxPrice !== '' ? 1 : 0) +
    (filters.availableOnly ? 1 : 0) +
    (filters.favouritesOnly ? 1 : 0);

  return {
    filters,
    setFilter,
    toggleDietary,
    resetFilters,
    results,
    activeFilterCount,
    initialFilters: INITIAL_FILTERS,
  };
}
