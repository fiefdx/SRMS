import { useMemo, useState } from 'react';
import { useApp } from '../../hooks/useApp';
import StatusBadge from '../../components/StatusBadge';
import { RESERVATION_TYPES } from '../../data/menuData';
import { formatDate, pluralise } from '../../utils/helpers';

const FILTERS = ['all', 'pending', 'approved', 'cancelled', 'events'];
const typeLabel = (id) => RESERVATION_TYPES.find((t) => t.id === id)?.label ?? id;

export default function AdminReservations() {
  const { reservations, tables, updateReservationStatus, deleteReservation, notify } = useApp();
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    if (filter === 'all') return reservations;
    if (filter === 'events') return reservations.filter((r) => r.type !== 'standard');
    return reservations.filter((r) => r.status === filter);
  }, [reservations, filter]);

  const tableLabel = (id) => tables.find((table) => table.id === id)?.label ?? id;

  return (
    <div className="grid" style={{ gap: '1.25rem' }}>
      <div className="card tight">
        <div className="card-heading">
          <h3>Bookings</h3>
          <div className="btn-row">
            {FILTERS.map((status) => (
              <button key={status} className={`tab${filter === status ? ' active' : ''}`} onClick={() => setFilter(status)}>
                {status}
              </button>
            ))}
          </div>
        </div>
        <p className="small muted">
          Approve or cancel requests. Cancelling a booking releases its table so another customer can
          take that slot.
        </p>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>When</th>
                <th>Type / guests</th>
                <th>Table</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    <strong>{reservation.id}</strong>
                    <div className="small muted">{formatDate(reservation.createdAt)}</div>
                  </td>
                  <td>
                    {reservation.customerName}
                    <div className="small muted">{reservation.email}</div>
                    <div className="small muted">{reservation.phone}</div>
                  </td>
                  <td>
                    {reservation.date}
                    <div className="small muted">{reservation.time}</div>
                  </td>
                  <td>
                    {typeLabel(reservation.type)}
                    <div className="small muted">{pluralise(reservation.guests, 'guest')}</div>
                    {reservation.requirements && (
                      <div className="small muted">“{reservation.requirements}”</div>
                    )}
                  </td>
                  <td>
                    {tableLabel(reservation.tableId)}
                    <div className="small muted">{reservation.tableId}</div>
                  </td>
                  <td>
                    <StatusBadge status={reservation.status} />
                  </td>
                  <td>
                    <div className="btn-row">
                      <button
                        className="btn small"
                        disabled={reservation.status === 'approved'}
                        onClick={() => {
                          updateReservationStatus(reservation.id, 'approved');
                          notify(`${reservation.id} approved — confirmation notification sent to ${reservation.customerName}.`);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn small danger"
                        disabled={reservation.status === 'cancelled'}
                        onClick={() => {
                          updateReservationStatus(reservation.id, 'cancelled');
                          notify(`${reservation.id} cancelled and its table released.`, 'info');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn small ghost"
                        onClick={() => {
                          deleteReservation(reservation.id);
                          notify(`${reservation.id} deleted.`, 'info');
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No bookings match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
