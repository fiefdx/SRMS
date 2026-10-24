import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import CartList from '../components/CartList';
import FormField from '../components/FormField';
import { calcTotals, formatMoney, isValidEmail, isValidPhone } from '../utils/helpers';

const PAYMENT_OPTIONS = [
  { value: 'card', label: 'Card on delivery' },
  { value: 'cash', label: 'Cash on collection' },
  { value: 'online', label: 'Pay online (simulated)' },
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  type: 'delivery',
  address: '',
  pickupTime: '19:00',
  payment: 'card',
  notes: '',
};

export default function Checkout() {
  const { cart, placeOrder, notify, user } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => ({
    ...emptyForm,
    name: user?.name ?? '',
    email: user?.email ?? '',
  }));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const totals = calcTotals(cart, form.type);

  const handleChange = (id, value) => {
    setForm((prev) => ({ ...prev, [id]: value }));
    // Clear the message for this field as soon as the customer edits it.
    setErrors((prev) => (prev[id] ? { ...prev, [id]: undefined } : prev));
  };

  /** Validation mirrors the rules we will enforce in the Assignment 2 backend. */
  function validate(values) {
    const next = {};

    if (values.name.trim().length < 2) next.name = 'Please enter your full name.';
    if (!isValidEmail(values.email)) next.email = 'Please enter a valid email address.';
    if (!isValidPhone(values.phone)) next.phone = 'Please enter a valid phone number (7–20 digits).';

    if (values.type === 'delivery' && values.address.trim().length < 6) {
      next.address = 'A delivery address of at least 6 characters is required.';
    }

    if (values.type === 'pickup') {
      if (!values.pickupTime) next.pickupTime = 'Choose a pickup time.';
      else {
        const minutes = Number(values.pickupTime.slice(0, 2)) * 60 + Number(values.pickupTime.slice(3, 5));
        if (minutes < 12 * 60 || minutes > 23 * 60 + 30) {
          next.pickupTime = 'Pickup is available between 12:00 and 23:30.';
        }
      }
    }

    if (cart.length === 0) next.cart = 'Your cart is empty — add at least one dish.';

    return next;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      notify('Please fix the highlighted fields.', 'error');
      return;
    }

    setSubmitting(true);
    // Small delay so the disabled "Placing order…" state is visible (simulated API latency).
    window.setTimeout(() => {
      const order = placeOrder(form);
      setSubmitting(false);
      notify(`Order ${order.id} confirmed. Total ${formatMoney(order.total)}.`);
      navigate(`/order/${order.id}`);
    }, 400);
  }

  if (cart.length === 0) {
    return (
      <div className="container page">
        <h1>Checkout</h1>
        <div className="banner error">Your cart is empty. Add dishes from the menu first.</div>
        <Link className="btn primary" to="/menu">Go to the menu</Link>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Checkout</h1>
          <p>Choose delivery or pickup, confirm your details and place the order. Payment is simulated.</p>
        </div>
        <Link to="/cart" className="small">← Back to cart</Link>
      </div>

      <div className="split">
        <form className="card form" onSubmit={handleSubmit} noValidate>
          {errors.cart && <div className="banner error">{errors.cart}</div>}

          <div className="field-row">
            <FormField
              id="name"
              label="Full name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              required
              placeholder="Alex Lee"
            />
            <FormField
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              required
              placeholder="alex@example.com"
            />
          </div>

          <div className="field-row">
            <FormField
              id="phone"
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              error={errors.phone}
              required
              placeholder="07700 900123"
            />
            <div className="field">
              <label htmlFor="type">Order type</label>
              <select
                id="type"
                className="select"
                value={form.type}
                onChange={(event) => handleChange('type', event.target.value)}
              >
                <option value="delivery">Delivery</option>
                <option value="pickup">Pickup</option>
              </select>
            </div>
          </div>

          {/* Conditional rendering: the address only matters for delivery. */}
          {form.type === 'delivery' ? (
            <FormField
              id="address"
              label="Delivery address"
              value={form.address}
              onChange={handleChange}
              error={errors.address}
              required
              placeholder="14 Maple Street, Apt 3"
            />
          ) : (
            <FormField
              id="pickupTime"
              label="Pickup time"
              type="time"
              value={form.pickupTime}
              onChange={handleChange}
              error={errors.pickupTime}
              hint="Kitchen is open 12:00 – 23:30 (closed Mondays)."
            />
          )}

          <div className="field">
            <label htmlFor="payment">Payment method (simulated)</label>
            <select
              id="payment"
              className="select"
              value={form.payment}
              onChange={(event) => handleChange('payment', event.target.value)}
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="small muted">
              No card details are collected — payment processing is out of scope for this project.
            </span>
          </div>

          <FormField
            id="notes"
            label="Notes for the kitchen"
            as="textarea"
            rows={3}
            value={form.notes}
            onChange={handleChange}
            placeholder="Allergies, buzzer number, extra napkins…"
          />

          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order · ${formatMoney(totals.total)}`}
          </button>
        </form>

        <aside className="card">
          <h3>Order summary</h3>
          <CartList items={cart} compact />
          <div className="totals">
            <div className="row">
              <span className="muted">Subtotal</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="row">
              <span className="muted">{form.type === 'delivery' ? 'Delivery fee' : 'Pickup'}</span>
              <span>{totals.deliveryFee > 0 ? formatMoney(totals.deliveryFee) : 'Free'}</span>
            </div>
            <div className="row">
              <span className="muted">Tax</span>
              <span>{formatMoney(totals.tax)}</span>
            </div>
            <div className="row grand">
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
