import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import FormField from '../components/FormField';
import { RESERVATION_TYPES, TABLES } from '../data/menuData';
import { addDaysISO, isValidEmail, isValidPhone, todayISODate } from '../utils/helpers';

// 12:00 → 22:00 in 30 minute steps.
const TIME_SLOTS = Array.from({ length: 21 }, (_, index) => {
  const minutes = 12 * 60 + index * 30;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

const CLOSED_DAYS = [1]; // new Date().getDay(): Monday = 1

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  date: todayISODate(),
  time: '19:00',
  guests: 2,
  type: 'standard',
  requirements: '',
};

export default function Reserve() {
  const { createReservation, findAvailableTable, notify, user } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    name: user?.name ?? '',
    email: user?.email ?? '',
  }));
  const [errors, setErrors] = useState({});

  const handleChange = (id, value) => {
    setForm((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => (prev[id] || prev.availability ? { ...prev, [id]: undefined, availability: undefined } : prev));
  };

  function validate(values) {
    const next = {};
    if (values.name.trim().length < 2) next.name = 'Please enter the name for the booking.';
    if (!isValidEmail(values.email)) next.email = 'Please enter a valid email address.';
    if (!isValidPhone(values.phone)) next.phone = 'Please enter a valid phone number.';

    if (!values.date) next.date = 'Choose a date.';
    else {
      const chosen = new Date(`${values.date}T12:00:00`);
      const today = new Date(`${todayISODate()}T12:00:00`);
      if (Number.isNaN(chosen.getTime())) next.date = 'That date is not valid.';
      else if (chosen < today) next.date = 'Bookings must be for today or a future date.';
      else if (CLOSED_DAYS.includes(chosen.getDay())) next.date = 'We are closed on Mondays.';
    }

    const guests = Number(values.guests);
    if (!Number.isInteger(guests) || guests < 1) next.guests = 'At least 1 guest.';
    else if (guests > 12) next.guests = 'For parties over 12, please contact us directly.';

    if (!TIME_SLOTS.includes(values.time)) next.time = 'Choose one of our service times.';

    return next;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);

    if (Object.keys(nextErrors).length === 0) {
      const result = createReservation({ ...form, guests: Number(form.guests) });
      if (!result.ok) {
        setErrors({ availability: result.error });
        notify(result.error, 'error');
        return;
      }
      notify(
        `Reservation ${result.reservation.id} received for ${result.reservation.date} at ${result.reservation.time} (table ${result.reservation.tableId}). Confirmation sent to ${result.reservation.email}.`,
      );
      navigate('/reservations');
      return;
    }

    setErrors(nextErrors);
    notify('Please fix the highlighted fields.', 'error');
  }

  // Live availability preview: recomputed on every render from the current form value.
  const previewTable =
    form.date && form.time && Number(form.guests) >= 1
      ? findAvailableTable(form.date, form.time, Number(form.guests))
      : null;

  const isEvent = form.type !== 'standard';

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Book a table or an event</h1>
          <p>
            Standard bookings, birthday parties and corporate gatherings. The system checks the table
            plan so the same table can never be booked twice for one slot.
          </p>
        </div>
      </div>

      <div className="split">
        <form className="card form" onSubmit={handleSubmit} noValidate>
          {errors.availability && <div className="banner error">{errors.availability}</div>}

          <div className="field-row">
            <FormField id="name" label="Name on the booking" value={form.name} onChange={handleChange} error={errors.name} required />
            <FormField id="email" label="Email" type="email" value={form.email} onChange={handleChange} error={errors.email} required />
          </div>

          <div className="field-row">
            <FormField id="phone" label="Phone" type="tel" value={form.phone} onChange={handleChange} error={errors.phone} required />
            <FormField
              id="guests"
              label="Guests"
              type="number"
              min="1"
              max="12"
              value={form.guests}
              onChange={handleChange}
              error={errors.guests}
              required
            />
          </div>

          <div className="field-row">
            <FormField
              id="date"
              label="Date"
              type="date"
              value={form.date}
              onChange={handleChange}
              error={errors.date}
              min={todayISODate()}
              max={addDaysISO(60)}
              required
            />
            <FormField
              id="time"
              label="Time"
              as="select"
              options={TIME_SLOTS.map((slot) => ({ value: slot, label: slot }))}
              value={form.time}
              onChange={handleChange}
              error={errors.time}
              required
            />
          </div>

          <FormField
            id="type"
            label="Booking type"
            as="select"
            options={RESERVATION_TYPES}
            value={form.type}
            onChange={handleChange}
            required
          />

          {/* Conditional rendering: event bookings collect extra requirements. */}
          {isEvent && (
            <FormField
              id="requirements"
              label="Event requirements"
              as="textarea"
              rows={4}
              value={form.requirements}
              onChange={handleChange}
              hint="Decorations, cake, microphone, dietary needs, menu pre-order…"
              placeholder="Birthday cake at 19:30, two vegetarian mains…"
            />
          )}

          <div className="btn-row">
            <button className="btn primary" type="submit">
              Request reservation
            </button>
          </div>
        </form>

        <aside className="card">
          <h3>Availability</h3>
          {previewTable ? (
            <>
              <p className="banner success">
                A table is available for {form.guests} guest(s) at {form.date} {form.time}.
              </p>
              <p className="small muted">
                Suggested table: <strong>{previewTable.label}</strong> ({previewTable.seats} seats)
              </p>
            </>
          ) : (
            <p className="banner error">
              No free table for {form.guests} guest(s) at {form.date} {form.time}. Try another time.
            </p>
          )}

          <h3 style={{ marginTop: '1rem' }}>Table plan</h3>
          <ul className="small muted">
            {TABLES.map((table) => (
              <li key={table.id}>
                {table.label} — {table.seats} seats
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ marginTop: '0.75rem' }}>
            We are closed on Mondays. Bookings are approved by the admin dashboard.
          </p>
        </aside>
      </div>
    </div>
  );
}
