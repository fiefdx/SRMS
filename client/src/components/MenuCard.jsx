import { truncate } from '../utils/helpers';

/** Text budget for the one section that may be shortened. */
const DESCRIPTION_MAX = 84;

/**
 * MenuCard is fully prop driven (no context access) so it can be reused by the customer menu,
 * the home page "popular items" list and the admin preview without hidden dependencies.
 *
 * Layout contract: emoji on the left with the full dish name to its right, then the description on its
 * own full-width row (max 2 lines, "…" if longer), dietary chips, the full ingredient list, then the
 * price and the action row pinned to the bottom of the card (primary button left, favourite button
 * right), so the price always sits directly above the buttons and the buttons always sit the same
 * distance from the bottom edge.
 */
export default function MenuCard({
  item,
  onAdd,
  isFavourite = false,
  onToggleFavourite,
  showFavourite = false,
  canSave = true,
  saveHint = 'Sign in to save dishes to your account',
}) {
  const price = Number(item.price).toFixed(2);
  const description = truncate(item.description, DESCRIPTION_MAX);

  return (
    <article className={`card menu-card${item.available ? '' : ' disabled'}`}>
      <div className="menu-card-top">
        <div className="menu-emoji" aria-hidden="true">{item.emoji}</div>
        <h3 className="menu-card-title" title={item.name}>{item.name}</h3>
      </div>

      {/* Description gets its own full-width row under the name. */}
      <p className="menu-card-desc muted small clamp-2" title={item.description}>
        {description}
      </p>

      <div className="chip-row menu-card-chips" aria-label="Dietary information">
        {item.todaySpecial && <span className="chip accent">Today&apos;s special</span>}
        {item.dietary.map((tag) => (
          <span key={tag} className="chip">{tag}</span>
        ))}
        {!item.available && <span className="badge unavailable">Unavailable</span>}
      </div>

      <p className="menu-card-ingredients small muted">
        <strong>Ingredients:</strong> {item.ingredients.join(', ')}
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
            disabled={!canSave}
            title={canSave ? (isFavourite ? 'Remove from your saved dishes' : 'Save this dish') : saveHint}
            aria-pressed={isFavourite}
          >
            {isFavourite ? '★ Saved' : '☆ Save'}
          </button>
        )}
      </div>
    </article>
  );
}
