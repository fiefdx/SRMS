import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import StatusBadge from '../components/StatusBadge';
import StatusTimeline from '../components/StatusTimeline';
import { formatDate, formatMoney, pluralise } from '../utils/helpers';

const RATINGS = [1, 2, 3, 4, 5];

export default function Orders() {
  const { orders, user, cancelOrder, notify, addFeedback, feedback } = useApp();
  const [feedbackFor, setFeedbackFor] = useState(null);
  const [draft, setDraft] = useState({ rating: 5, comment: '' });
  const [errors, setErrors] = useState({});

  // Customers only see their own history; guests see the demo history of the restaurant.
  const visibleOrders = useMemo(
    () => (user ? orders.filter((o) => o.email === user.email) : orders),
    [orders, user],
  );

  const handleFeedbackChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const submitFeedback = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!draft.rating) nextErrors.rating = 'Choose a rating from 1 to 5.';
    if (draft.comment.trim().length < 10) nextErrors.comment = 'Please write at least 10 characters.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const order = orders.find((o) => o.id === feedbackFor);
    addFeedback({
      orderId: feedbackFor,
      customerName: user?.name ?? order?.customerName ?? 'Guest',
      rating: Number(draft.rating),
      comment: draft.comment.trim(),
    });
    setFeedbackFor(null);
    setDraft({ rating: 5, comment: '' });
    notify('Thanks! Your feedback was recorded and is visible on the admin dashboard.');
  };

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>My orders</h1>
          <p>
            {user
              ? `Order history for ${user.email}.`
              : 'Signed-in customers see only their own orders; right now you are browsing the demo history.'}
          </p>
        </div>
        <Link className="btn small" to="/menu">
          New order
        </Link>
      </div>

      {visibleOrders.length === 0 ? (
        <div className="empty">No orders yet. Add dishes from the menu and check out.</div>
      ) : (
        <div className="grid">
          {visibleOrders.map((order) => {
            const orderFeedback = feedback.find((entry) => entry.orderId === order.id);
            return (
              <article className="card" key={order.id}>
                <div className="card-heading">
                  <div>
                    <h3>
                      {order.id} · {pluralise(order.items.reduce((s, i) => s + i.quantity, 0), 'item')}
                    </h3>
                    <span className="small muted">
                      {formatDate(order.createdAt)} · {order.type} · {order.customerName}
                    </span>
                  </div>
                  <div className="right">
                    <StatusBadge status={order.status} />
                    <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                      {formatMoney(order.total)}
                    </div>
                  </div>
                </div>

                <p className="small muted">
                  {order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                </p>

                <StatusTimeline status={order.status} />

                <div className="btn-row" style={{ marginTop: '0.9rem' }}>
                  <Link className="btn small" to={`/order/${order.id}`}>
                    View details
                  </Link>
                  {['pending', 'preparing'].includes(order.status) && (
                    <button
                      className="btn small danger"
                      onClick={() => {
                        cancelOrder(order.id);
                        notify(`Order ${order.id} cancelled.`, 'info');
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    className="btn small ghost"
                    onClick={() => setFeedbackFor(order.id)}
                    disabled={Boolean(orderFeedback)}
                  >
                    {orderFeedback ? 'Feedback left' : 'Leave feedback'}
                  </button>
                </div>

                {orderFeedback && (
                  <p className="small muted" style={{ marginTop: '0.6rem' }}>
                    <span className="rating">{'★'.repeat(orderFeedback.rating)}</span>{' '}
                    {orderFeedback.comment}
                  </p>
                )}

                {feedbackFor === order.id && (
                  <form className="card tight form" style={{ marginTop: '0.8rem' }} onSubmit={submitFeedback}>
                    <div className="field">
                      <label htmlFor={`rating-${order.id}`}>Rating</label>
                      <select
                        id={`rating-${order.id}`}
                        className="select"
                        value={draft.rating}
                        onChange={(event) => handleFeedbackChange('rating', event.target.value)}
                      >
                        {RATINGS.map((value) => (
                          <option key={value} value={value}>
                            {value} star{value > 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                      {errors.rating && <span className="error">{errors.rating}</span>}
                    </div>

                    <div className="field">
                      <label htmlFor={`comment-${order.id}`}>How was it?</label>
                      <textarea
                        id={`comment-${order.id}`}
                        className="textarea"
                        value={draft.comment}
                        onChange={(event) => handleFeedbackChange('comment', event.target.value)}
                        placeholder="Food quality, delivery time, presentation…"
                      />
                      {errors.comment && <span className="error">{errors.comment}</span>}
                    </div>

                    <div className="btn-row">
                      <button className="btn primary small" type="submit">
                        Submit feedback
                      </button>
                      <button className="btn ghost small" type="button" onClick={() => setFeedbackFor(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
