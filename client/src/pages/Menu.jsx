import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import useMenuFilters from '../hooks/useMenuFilters';
import MenuFilters from '../components/MenuFilters';
import MenuCard from '../components/MenuCard';
import { CATEGORIES } from '../data/menuData';

export default function Menu() {
  const { menuItems, addToCart, notify, preferences, toggleFavourite, user } = useApp();

  const { filters, setFilter, toggleDietary, resetFilters, results, activeFilterCount } =
    useMenuFilters(menuItems, preferences.favouriteIds);

  const handleAdd = (item) => {
    addToCart(item);
    notify(`${item.name} added to your cart.`);
  };

  const handleToggleFavourite = (id) => {
    if (!user) return;
    toggleFavourite(id);
    notify('Favourites updated.', 'info');
  };

  // Grouping keeps the menu readable; a section is only rendered when it has results.
  const grouped = CATEGORIES.map((category) => ({
    category,
    items: results.filter((item) => item.category === category.id),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Our menu</h1>
          <p>
            Starters, mains, desserts and beverages with descriptions, ingredients and allergen-style
            tags. Filter by category, dietary requirement or price, then add items to your cart.
          </p>
        </div>
        {!user && (
          <Link className="btn small" to="/account">
            Sign in to save favourites
          </Link>
        )}
      </div>

      <MenuFilters
        filters={filters}
        setFilter={setFilter}
        toggleDietary={toggleDietary}
        resetFilters={resetFilters}
        resultCount={results.length}
        totalCount={menuItems.length}
        activeFilterCount={activeFilterCount}
        showFavouritesToggle={!!user && preferences.favouriteIds.length > 0}
      />

      {results.length === 0 ? (
        <div className="empty" style={{ marginTop: '1.5rem' }}>
          No dish matches those filters. Try clearing a filter or searching an ingredient.
        </div>
      ) : (
        <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1.75rem' }}>
          {grouped.map((group) => (
            <section key={group.category.id}>
              <div className="card-heading">
                <h2>{group.category.label}</h2>
                <span className="muted small">{group.items.length} dishes</span>
              </div>
              <div className="grid grid-2">
                {group.items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    onAdd={handleAdd}
                    showFavourite
                    canSave={!!user}
                    isFavourite={!!user && preferences.favouriteIds.includes(item.id)}
                    onToggleFavourite={handleToggleFavourite}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
