import { truncate } from '../utils/helpers';

/** Text budgets per card section keep every card the same height. */
const DESCRIPTION_MAX = 84;
const INGREDIENTS_MAX = 64;

/**
 * MenuCard is fully prop driven (no context access) so it can be reused by the customer menu,
 * the home page "popular items" list and the admin preview without hidden dependencies.
 *
 * Layout contract: full dish name (never shortened, wraps over two lines and the title block reserves
 * that space), description (max 2 lines, "…" if longer), dietary chips, ingredients (max 2 lines),
 * then the price and the action row pinned to the bottom of the card, so the price always sits
 * directly above the buttons and the buttons always sit the same distance from the bottom edge.
 */
export default function MenuCard({
  item,
  onAdd,
  isFavourite = false,
  onToggleFavourite,
  showFavourite = false,
}) {
  const price = Number(item.price).toFixed(2);
  const description = truncate(item.description, DESCRIPTION_MAX);
  const ingredients = truncate(item.ingredients.join(', '), INGREDIENTS_MAX);

  return (
    <article className={`card menu-card${item.available ? '' : ' disabled'}`}>
      <div className="menu-card-top">
        <div className="menu-emoji" aria-hidden="true">{item.emoji}</div>
        <div className="menu-card-headline">
          <h3 className="menu-card-title" title={item.name}>
            {item.name}
          </h3>
          <p className="menu-card-desc muted small clamp-2" title={item.description}>
            {description}
          </p>
        </div>
      </div>

      <div className="chip-row menu-card-chips" aria-label="Dietary information">
        {item.todaySpecial && <span className="chip accent">Today&apos;s special</span>}
        {item.dietary.map((tag) => (
          <span key={tag} className="chip">{tag}</span>
        ))}
        {!item.available && <span className="badge unavailable">Unavailable</span>}
      </div>

      <p className="menu-card-ingredients small muted clamp-2" title={item.ingredients.join(', ')}>
        <strong>Ingredients:</strong> {ingredients}
      </p>

      <div className="menu-card-price">
        <span className="small muted">Price</span>
        <span className="price nowrap">${price}</span>
      </div>

      <div className="menu-card-footer">
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
