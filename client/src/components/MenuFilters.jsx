import { CATEGORIES, DIETARY_TAGS } from '../data/menuData';

/**
 * Props in, events out — this component owns no data. The page owns the state through
 * useMenuFilters, which keeps the filter UI reusable for the admin menu list as well.
 */
export default function MenuFilters({
  filters,
  setFilter,
  toggleDietary,
  resetFilters,
  resultCount,
  totalCount,
  activeFilterCount,
  showFavouritesToggle = false,
}) {
  return (
    <section className="card" aria-label="Menu filters">
      <div className="card-heading">
        <h3>Find a dish</h3>
        <span className="muted small">
          Showing {resultCount} of {totalCount} items
          {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="tabs" role="tablist" aria-label="Menu categories">
        <button
          role="tab"
          aria-selected={filters.category === 'all'}
          className={`tab${filters.category === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('category', 'all')}
        >
          All
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            role="tab"
            aria-selected={filters.category === category.id}
            className={`tab${filters.category === category.id ? ' active' : ''}`}
            onClick={() => setFilter('category', category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="filters" style={{ marginTop: '1rem' }}>
        <div className="field">
          <label htmlFor="menu-search">Search name, description or ingredient</label>
          <input
            id="menu-search"
            className="input"
            type="search"
            placeholder="e.g. truffle, chicken, gluten-free…"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="price-min">Price from ($)</label>
          <input
            id="price-min"
            className="input"
            type="number"
            min="0"
            step="0.5"
            placeholder="0"
            value={filters.minPrice}
            onChange={(event) => setFilter('minPrice', event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="price-max">Price to ($)</label>
          <input
            id="price-max"
            className="input"
            type="number"
            min="0"
            step="0.5"
            placeholder="30"
            value={filters.maxPrice}
            onChange={(event) => setFilter('maxPrice', event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="menu-sort">Sort by</label>
          <select
            id="menu-sort"
            className="select"
            value={filters.sort}
            onChange={(event) => setFilter('sort', event.target.value)}
          >
            <option value="default">Chef&apos;s order</option>
            <option value="popular">Most popular</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      <div className="field" style={{ marginTop: '1rem' }}>
        <label>Dietary restrictions</label>
        <div className="checkbox-group">
          {DIETARY_TAGS.map((tag) => (
            <label
              key={tag.id}
              className={`checkbox${filters.dietary.includes(tag.id) ? ' checked' : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.dietary.includes(tag.id)}
                onChange={() => toggleDietary(tag.id)}
              />
              {tag.label}
            </label>
          ))}
        </div>
      </div>

      <div className="checkbox-group" style={{ marginTop: '0.75rem' }}>
        <label className={`checkbox${filters.availableOnly ? ' checked' : ''}`}>
          <input
            type="checkbox"
            checked={filters.availableOnly}
            onChange={(event) => setFilter('availableOnly', event.target.checked)}
          />
          Available only
        </label>

        {showFavouritesToggle && (
          <label className={`checkbox${filters.favouritesOnly ? ' checked' : ''}`}>
            <input
              type="checkbox"
              checked={filters.favouritesOnly}
              onChange={(event) => setFilter('favouritesOnly', event.target.checked)}
            />
            My favourites only
          </label>
        )}

        <button className="btn small ghost" onClick={resetFilters} disabled={activeFilterCount === 0}>
          Clear filters
        </button>
      </div>
    </section>
  );
}
