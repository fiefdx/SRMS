import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import CartList from '../components/CartList';
import { DELIVERY_FEE, FREE_DELIVERY_FROM, formatMoney } from '../utils/helpers';

export default function Cart() {
  const { cart, cartCount, cartTotals, updateQuantity, removeFromCart, clearCart, notify } = useApp();

  const handleQuantityChange = (id, quantity) => {
    if (quantity < 1) {
      removeFromCart(id);
      notify('Item removed from your cart.', 'info');
      return;
    }
    updateQuantity(id, quantity);
  };

  const remainingForFreeDelivery = FREE_DELIVERY_FROM - cartTotals.subtotal;

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Your cart</h1>
          <p>Change quantities or remove items. Totals include delivery and tax.</p>
        </div>
        {cart.length > 0 && (
          <button
            className="btn small ghost"
            onClick={() => {
              clearCart();
              notify('Cart cleared.', 'info');
            }}
          >
            Clear cart
          </button>
        )}
      </div>

      <div className="split">
        <section className="card">
          <div className="card-heading">
            <h3>Items ({cartCount})</h3>
          </div>
          <CartList
            items={cart}
            onQuantityChange={handleQuantityChange}
            onRemove={(id) => {
              removeFromCart(id);
              notify('Item removed from your cart.', 'info');
            }}
          />
        </section>

        <section className="card">
          <h3>Summary</h3>
          <div className="totals">
            <div className="row">
              <span className="muted">Subtotal</span>
              <span>{formatMoney(cartTotals.subtotal)}</span>
            </div>
            <div className="row">
              <span className="muted">Delivery (if applicable)</span>
              <span>{formatMoney(cartTotals.deliveryFee || DELIVERY_FEE)}</span>
            </div>
            <div className="row">
              <span className="muted">Tax (9%)</span>
              <span>{formatMoney(cartTotals.tax)}</span>
            </div>
            <div className="row grand">
              <span>Total</span>
              <span>{formatMoney(cartTotals.total)}</span>
            </div>
          </div>

          {cart.length > 0 && remainingForFreeDelivery > 0 && (
            <p className="small muted" style={{ marginTop: '0.6rem' }}>
              Spend {formatMoney(remainingForFreeDelivery)} more for free delivery.
            </p>
          )}

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <Link className="btn primary" to="/checkout">
              Go to checkout
            </Link>
            <Link className="btn ghost" to="/menu">
              Keep browsing the menu
            </Link>
          </div>

          {cart.length === 0 && (
            <p className="small muted" style={{ marginTop: '0.75rem' }}>
              Add a dish from the menu to start an order.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
