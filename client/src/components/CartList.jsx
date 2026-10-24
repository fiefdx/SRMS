import { cartLineTotal, formatMoney, pluralise } from '../utils/helpers';

/**
 * Shared cart/order line renderer used by the cart page, the confirmation page and the admin
 * order table. Quantity controls only appear when onQuantityChange is provided.
 */
export default function CartList({
  items,
  onQuantityChange,
  onRemove,
  compact = false,
  emptyMessage = 'Your cart is empty.',
}) {
  if (items.length === 0) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <div className="line-items">
      {items.map((item) => (
        <div className="line-item" key={item.id}>
          <div>
            <strong>{item.name}</strong>
            {!compact && (
              <div className="small muted">
                {formatMoney(item.price)} each · {pluralise(item.quantity, 'item')}
              </div>
            )}
          </div>

          {onQuantityChange ? (
            <div className="qty">
              <button
                onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                aria-label={`Decrease quantity of ${item.name}`}
              >
                −
              </button>
              <span>{item.quantity}</span>
              <button
                onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                aria-label={`Increase quantity of ${item.name}`}
              >
                +
              </button>
            </div>
          ) : (
            <div className="muted">×{item.quantity}</div>
          )}

          <div className="nowrap">{formatMoney(cartLineTotal(item))}</div>

          {onRemove && (
            <button className="btn small danger" onClick={() => onRemove(item.id)}>
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
