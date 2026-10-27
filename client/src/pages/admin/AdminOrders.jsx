import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../hooks/useApp';
import StatusBadge from '../../components/StatusBadge';
import { ORDER_STATUS_FLOW } from '../../data/menuData';
import { formatDate, formatMoney, pluralise } from '../../utils/helpers';

const FILTERS = ['all', ...ORDER_STATUS_FLOW, 'cancelled'];

export default function AdminOrders() {
  const { orders, updateOrderStatus, notify } = useApp();
  const [statusFilter, setStatusFilter] = useState('all');

  const visible = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((order) => order.status === statusFilter)),
    [orders, statusFilter],
  );

  const advance = (order) => {
    const index = ORDER_STATUS_FLOW.indexOf(order.status);
    const next = ORDER_STATUS_FLOW[Math.min(index + 1, ORDER_STATUS_FLOW.length - 1)];
    updateOrderStatus(order.id, next);
    notify(`${order.id} moved to “${next}”. The customer sees the update on their order page.`);
  };

  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <div className="card tight">
        <div className="card-heading">
          <h3>Incoming orders</h3>
          <div className="btn-row">
            {FILTERS.map((status) => (
              <button
                key={status}
                className={`tab${statusFilter === status ? ' active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <p className="small muted">
          {visible.length} order(s) shown · updating a status is pushed straight to the customer view.
        </p>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="right">Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/order/${order.id}`}>{order.id}</Link>
                    <div className="small muted">
                      {formatDate(order.createdAt)} · {order.type}
                      {order.type === 'delivery' ? ` → ${order.address}` : ` @ ${order.pickupTime || 'counter'}`}
                    </div>
                  </td>
                  <td>
                    {order.customerName}
                    <div className="small muted">{order.phone}</div>
                  </td>
                  <td>
                    <ul className="small">
                      {order.items.map((line) => (
                        <li key={line.id}>
                          {line.quantity}× {line.name}
                        </li>
                      ))}
                    </ul>
                    {order.notes && <div className="small muted">“{order.notes}”</div>}
                  </td>
                  <td className="right">{formatMoney(order.total)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>
                    <div className="btn-row">
                      <select
                        className="select auto"
                        value={order.status}
                        onChange={(event) => {
                          updateOrderStatus(order.id, event.target.value);
                          notify(`${order.id} set to “${event.target.value}”.`);
                        }}
                        aria-label={`Status of ${order.id}`}
                      >
                        {[...ORDER_STATUS_FLOW, 'cancelled'].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button
                        className="btn small"
                        onClick={() => advance(order)}
                        disabled={order.status === 'delivered' || order.status === 'cancelled'}
                      >
                        Advance
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No {statusFilter === 'all' ? '' : statusFilter} orders.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: '0.75rem' }}>
          {pluralise(orders.length, 'order')} in total across all statuses.
        </p>
      </section>
    </div>
  );
}
