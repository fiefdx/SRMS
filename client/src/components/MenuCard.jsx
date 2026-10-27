import { truncate } from '../utils/helpers';

/** Text budgets per card section keep every card the same height. */
const TITLE_MAX = 30;
const DESCRIPTION_MAX = 84;
const INGREDIENTS_MAX = 64;

/**
 * MenuCard is fully prop driven (no context access) so it can be reused by the customer menu,
 * the home page "popular items" list and the admin preview without hidden dependencies.
 *
 * Layout contract: title (1 line), description (max 2 lines, "…" if longer), dietary chips,
 * ingredients (max 2 lines) and the action row pinned to the bottom of the card, so buttons always
 * sit the same distance from the card's bottom edge.
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
          <h3 className="clamp-1" title={item.name}>
            {truncate(item.name, TITLE_MAX)}
          </h3>
          <p className="menu-card-desc muted small clamp-2" title={item.description}>
            {description}
          </p>
        </div>
        <div className="price nowrap">${price}</div>
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
