/**
 * MenuCard is fully prop driven (no context access) so it can be reused by the customer menu,
 * the home page "popular items" list and the admin preview without hidden dependencies.
 */
export default function MenuCard({
  item,
  onAdd,
  isFavourite = false,
  onToggleFavourite,
  showFavourite = false,
}) {
  const price = Number(item.price).toFixed(2);

  return (
    <article className={`card menu-card${item.available ? '' : ' disabled'}`}>
      <div className="menu-card-top">
        <div className="menu-emoji" aria-hidden="true">{item.emoji}</div>
        <div style={{ flex: 1 }}>
          <h3>
            {item.name}
            {item.todaySpecial && <span className="chip accent" style={{ marginLeft: 8 }}>Today&apos;s special</span>}
          </h3>
          <p className="muted small">{item.description}</p>
        </div>
        <div className="price nowrap">${price}</div>
      </div>

      <div className="chip-row" aria-label="Dietary information">
        {item.dietary.map((tag) => (
          <span key={tag} className="chip">{tag}</span>
        ))}
        {!item.available && <span className="badge unavailable">Unavailable</span>}
      </div>

      <p className="small muted">
        <strong>Ingredients:</strong> {item.ingredients.join(', ')}
      </p>

      <div className="btn-row">
        <button
          className="btn primary small"
          disabled={!item.available}
          onClick={() => onAdd(item)}
        >
          {item.available ? 'Add to cart' : 'Currently unavailable'}
        </button>

        {showFavourite && (
          <button
            className="btn small ghost"
            onClick={() => onToggleFavourite?.(item.id)}
            aria-pressed={isFavourite}
          >
            {isFavourite ? '★ Saved' : '☆ Save'}
          </button>
        )}
      </div>
    </article>
  );
}
