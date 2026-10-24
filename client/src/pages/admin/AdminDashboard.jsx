import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import StatCard from '../../components/StatCard';
import BarChart from '../../components/BarChart';
import StatusBadge from '../../components/StatusBadge';
import { feedbackSummary, ordersByDay, orderedFrequency, reservationSummary, revenueSummary } from '../../utils/analytics';
import { formatDate, formatMoney } from '../../utils/helpers';

export default function AdminDashboard() {
  const { orders, reservations, feedback, menuItems } = useApp();

  // All analytics is derived with useMemo: nothing is stored twice.
  const stats = useMemo(() => revenueSummary(orders), [orders]);
  const perDay = useMemo(
    () => ordersByDay(orders, 7).map((day) => ({ label: day.label, value: day.count, revenue: day.revenue })),
    [orders],
  );
  const topItems = useMemo(() => orderedFrequency(orders).slice(0, 5), [orders]);
  const bookings = useMemo(() => reservationSummary(reservations), [reservations]);
  const reviews = useMemo(() => feedbackSummary(feedback), [feedback]);

  const unavailable = menuItems.filter((item) => !item.available);
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <section className="grid grid-4">
        <StatCard label="Active orders" value={stats.orders} hint={`${stats.open} still in the kitchen`} />
        <StatCard label="Revenue (active orders)" value={formatMoney(stats.revenue)} hint={`${stats.cancelled} cancelled`} />
        <StatCard label="Average order" value={formatMoney(stats.average)} hint="incl. delivery and tax" />
        <StatCard label="Bookings" value={bookings.total} hint={`${bookings.pending} awaiting approval · ${bookings.events} events`} />
      </section>

      <section className="card">
        <div className="card-heading">
          <h3>Orders per day (last 7 days)</h3>
          <span className="small muted">
            {perDay.reduce((sum, day) => sum + day.value, 0)} orders ·{' '}
            {formatMoney(perDay.reduce((sum, day) => sum + day.revenue, 0))}
          </span>
        </div>
        <BarChart data={perDay} />
      </section>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-heading">
            <h3>Most ordered dishes</h3>
            <span className="small muted">drives the AI recommendations</span>
          </div>
          {topItems.length === 0 ? (
            <p className="small muted">No orders recorded yet.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th className="right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map((entry) => (
                  <tr key={entry.name}>
                    <td>{entry.name}</td>
                    <td className="right">{entry.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-heading">
            <h3>Customer feedback summary</h3>
            <span className="small muted">
              average {reviews.average.toFixed(1)} / 5 · {reviews.count} review(s)
            </span>
          </div>
          <div className="chip-row">
            <span className="chip accent">positive: {reviews.sentiment.positive}</span>
            <span className="chip">neutral: {reviews.sentiment.neutral}</span>
            <span className="chip">negative: {reviews.sentiment.negative}</span>
          </div>
          <p className="small muted" style={{ marginTop: '0.75rem' }}>
            {reviews.positives.length > 0 && (
              <>
                <strong>Customers praise:</strong> {reviews.positives.join(', ')}.{' '}
              </>
            )}
            {reviews.negatives.length > 0 && (
              <>
                <strong>Watch out for:</strong> {reviews.negatives.join(', ')}.
              </>
            )}
            {reviews.count === 0 && 'No feedback recorded yet.'}
          </p>
        </section>
      </div>

      <section className="card">
        <div className="card-heading">
          <h3>Latest orders</h3>
          <Link to="/admin/orders">Manage all orders →</Link>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
                <th className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/order/${order.id}`}>{order.id}</Link>
                    <div className="small muted">{formatDate(order.createdAt)}</div>
                  </td>
                  <td>{order.customerName}</td>
                  <td>{order.type}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="right">{formatMoney(order.total)}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-heading">
          <h3>Menu availability</h3>
          <Link to="/admin/menu">Edit menu →</Link>
        </div>
        <p className="small muted">
          {menuItems.length} items, {unavailable.length} marked unavailable.
          {unavailable.length > 0 && <> Unavailable: {unavailable.map((item) => item.name).join(', ')}.</>}
        </p>
      </section>
    </div>
  );
}
