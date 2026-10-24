import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import FormField from '../components/FormField';
import StatusBadge from '../components/StatusBadge';
import { DIETARY_TAGS } from '../data/menuData';
import { formatDate, formatMoney, isValidEmail } from '../utils/helpers';

export default function Account() {
  const {
    user,
    signIn,
    signOut,
    notify,
    preferences,
    setDietaryPreferences,
    menuItems,
    orders,
    reservations,
  } = useApp();

  const [form, setForm] = useState({ name: '', email: '', password: '', asAdmin: false });
  const [errors, setErrors] = useState({});

  const myOrders = useMemo(
    () => (user ? orders.filter((o) => o.email === user.email) : []),
    [orders, user],
  );
  const myReservations = useMemo(
    () => (user ? reservations.filter((r) => r.email === user.email) : []),
    [reservations, user],
  );
  const favourites = useMemo(
    () => menuItems.filter((item) => preferences.favouriteIds.includes(item.id)),
    [menuItems, preferences.favouriteIds],
  );

  const handleChange = (id, value) => {
    setForm((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => (prev[id] ? { ...prev, [id]: undefined } : prev));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const next = {};
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (form.password.length < 6) next.password = 'Password must be at least 6 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const account = signIn({ name: form.name.trim(), email: form.email.trim() }, form.asAdmin);
    notify(`Signed in as ${account.name} (${account.role}).`);
  };

  const togglePreference = (tagId) => {
    const next = preferences.dietary.includes(tagId)
      ? preferences.dietary.filter((t) => t !== tagId)
      : [...preferences.dietary, tagId];
    setDietaryPreferences(next);
  };

  /* ------------------------------------------------ sign in (not authenticated) */
  if (!user) {
    return (
      <div className="container page">
        <div className="page-header">
          <div>
            <h1>Sign in</h1>
            <p>
              Accounts are simulated in the frontend for Assignment 1 (no password is stored). Real
              login, JWT/session handling and role-based access arrive with the Node.js backend in
              Assignment 2.
            </p>
          </div>
        </div>

        <div className="split">
          <form className="card form" onSubmit={handleSubmit} noValidate>
            <FormField id="name" label="Your name (optional)" value={form.name} onChange={handleChange} placeholder="Alex Lee" />
            <FormField id="email" label="Email" type="email" value={form.email} onChange={handleChange} error={errors.email} required placeholder="alex@example.com" />
            <FormField
              id="password"
              label="Password"
              type="password"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              required
              hint="Demo only — never typed anywhere real. Minimum 6 characters."
            />

            <label className={`checkbox${form.asAdmin ? ' checked' : ''}`}>
              <input type="checkbox" checked={form.asAdmin} onChange={(e) => handleChange('asAdmin', e.target.checked)} />
              Sign in as administrator
            </label>
            <span className="small muted">
              Tip: an email of admin@srms.dev is recognised as an administrator automatically.
            </span>

            <button className="btn primary" type="submit">
              Sign in
            </button>
          </form>

          <aside className="card">
            <h3>What an account gives you</h3>
            <ul className="small muted">
              <li>Save favourite dishes and filter the menu by them.</li>
              <li>Store your dietary preferences for the AI assistant.</li>
              <li>See only your own orders and reservations.</li>
              <li>Leave feedback that feeds the admin analytics.</li>
            </ul>
          </aside>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------- profile (authenticated) */
  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>{user.name}</h1>
          <p>
            {user.email} · role: {user.role}
            {user.role === 'admin' && (
              <>
                {' '}· <Link to="/admin">open the admin dashboard</Link>
              </>
            )}
          </p>
        </div>
        <button className="btn small ghost" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="split">
        <section className="card">
          <h3>Dietary preferences</h3>
          <p className="small muted">
            Used by the AI assistant when it recommends dishes, and a good starting point for menu
            filters.
          </p>
          <div className="checkbox-group">
            {DIETARY_TAGS.map((tag) => (
              <label
                key={tag.id}
                className={`checkbox${preferences.dietary.includes(tag.id) ? ' checked' : ''}`}
              >
                <input type="checkbox" checked={preferences.dietary.includes(tag.id)} onChange={() => togglePreference(tag.id)} />
                {tag.label}
              </label>
            ))}
          </div>

          <h3 style={{ marginTop: '1.2rem' }}>Favourite dishes ({favourites.length})</h3>
          {favourites.length === 0 ? (
            <p className="small muted">
              Tap “☆ Save” on any menu card to keep it here. <Link to="/menu">Go to the menu</Link>
            </p>
          ) : (
            <ul className="small muted">
              {favourites.map((item) => (
                <li key={item.id}>
                  {item.emoji} {item.name} — {formatMoney(item.price)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>Recent activity</h3>
          <p className="small muted">
            {myOrders.length} order(s) · {myReservations.length} reservation(s)
          </p>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="right">Total</th>
                </tr>
              </thead>
              <tbody>
                {myOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/order/${order.id}`}>{order.id}</Link>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="right">{formatMoney(order.total)}</td>
                  </tr>
                ))}
                {myOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <Link className="btn small" to="/orders">
              All orders
            </Link>
            <Link className="btn small" to="/reservations">
              My reservations
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
