import { Link, useParams } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import CartList from '../components/CartList';
import StatusBadge from '../components/StatusBadge';
import StatusTimeline from '../components/StatusTimeline';
import { formatDate, formatMoney } from '../utils/helpers';

export default function OrderConfirmation() {
  const { id } = useParams();
  const { orders, cancelOrder, notify } = useApp();

  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="container page">
        <div className="banner error">Order {id} was not found.</div>
        <Link className="btn primary" to="/orders">
          See my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Order confirmed 🎉</h1>
          <p>
            Order <strong>{order.id}</strong> placed {formatDate(order.createdAt)} for{' '}
            {order.type === 'delivery' ? `delivery to ${order.address}` : `pickup${order.pickupTime ? ` at ${order.pickupTime}` : ''}`}.
            {' '}We will update the status as the kitchen works through it.
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="split">
        <section className="card">
          <h3>Items</h3>
          <CartList items={order.items} compact emptyMessage="This order has no items." />
          <div className="totals">
            <div className="row">
              <span className="muted">Subtotal</span>
              <span>{formatMoney(order.subtotal)}</span>
            </div>
            <div className="row">
              <span className="muted">Delivery</span>
              <span>{order.deliveryFee > 0 ? formatMoney(order.deliveryFee) : 'Free'}</span>
            </div>
            <div className="row">
              <span className="muted">Tax</span>
              <span>{formatMoney(order.tax)}</span>
            </div>
            <div className="row grand">
              <span>Total</span>
              <span>{formatMoney(order.total)}</span>
            </div>
          </div>
        </section>

        <section className="card">
          <h3>Status</h3>
          <StatusTimeline status={order.status} />

          {order.notes && (
            <p className="small muted" style={{ marginTop: '0.8rem' }}>
              <strong>Your note:</strong> {order.notes}
            </p>
          )}

          <p className="small muted" style={{ marginTop: '0.8rem' }}>
            Estimated {order.type === 'delivery' ? 'delivery' : 'pickup'}: 35–50 minutes. A confirmation
            email would be sent to {order.email} in the fullstack version.
          </p>

          <div className="btn-row">
            <Link className="btn" to="/orders">
              Track all my orders
            </Link>
            {['pending', 'preparing'].includes(order.status) && (
              <button
                className="btn danger small"
                onClick={() => {
                  cancelOrder(order.id);
                  notify(`Order ${order.id} cancelled.`, 'info');
                }}
              >
                Cancel order
              </button>
            )}
            <Link className="btn ghost" to="/menu">
              Order again
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
