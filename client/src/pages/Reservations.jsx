import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import StatusBadge from '../components/StatusBadge';
import { formatDate, pluralise } from '../utils/helpers';
import { RESERVATION_TYPES } from '../data/menuData';

const typeLabel = (id) => RESERVATION_TYPES.find((t) => t.id === id)?.label ?? id;

export default function Reservations() {
  const { myReservations, updateReservationStatus, deleteReservation, notify } = useApp();

  // Store-scoped: account bookings when signed in, this browser session when signed out.
  const visible = myReservations;

  const upcoming = visible.filter((r) => r.status !== 'cancelled');
  const past = visible.filter((r) => r.status === 'cancelled');

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Reservations</h1>
          <p>
            Your bookings and event requests. Status is <strong>pending</strong> until an administrator
            approves it; you can cancel at any time before then.
          </p>
        </div>
        <Link className="btn primary" to="/reserve">
          New reservation
        </Link>
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="empty">No reservations yet. Book a table for your next visit.</div>
      ) : (
        <div className="grid grid-2">
          {upcoming.map((reservation) => (
            <article className="card" key={reservation.id}>
              <div className="card-heading">
                <div>
                  <h3>
                    {typeLabel(reservation.type)} · {reservation.date} {reservation.time}
                  </h3>
                  <span className="small muted">
                    {pluralise(reservation.guests, 'guest')} · table {reservation.tableId} ·{' '}
                    {reservation.customerName}
                  </span>
                </div>
                <StatusBadge status={reservation.status} />
              </div>

              {reservation.requirements && (
                <p className="small muted">
                  <strong>Requirements:</strong> {reservation.requirements}
                </p>
              )}

              <p className="small muted">
                Booking reference {reservation.id} · requested {formatDate(reservation.createdAt)} ·
                confirmation sent to {reservation.email}
              </p>

              <div className="btn-row">
                {reservation.status === 'approved' ? (
                  <span className="chip accent">Confirmed — see you soon</span>
                ) : (
                  <span className="chip">Waiting for admin approval</span>
                )}
                <button
                  className="btn small danger"
                  onClick={() => {
                    updateReservationStatus(reservation.id, 'cancelled');
                    notify(`Reservation ${reservation.id} cancelled.`, 'info');
                  }}
                >
                  Cancel booking
                </button>
              </div>
            </article>
          ))}

          {past.map((reservation) => (
            <article className="card" key={reservation.id}>
              <div className="card-heading">
                <div>
                  <h3>{typeLabel(reservation.type)} · {reservation.date} {reservation.time}</h3>
                  <span className="small muted">Cancelled</span>
                </div>
                <StatusBadge status={reservation.status} />
              </div>
              <div className="btn-row">
                <Link className="btn small ghost" to="/reserve">
                  Book again
                </Link>
                <button
                  className="btn small danger"
                  onClick={() => {
                    deleteReservation(reservation.id);
                    notify('Cancelled reservation removed.', 'info');
                  }}
                >
                  Remove from my list
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
