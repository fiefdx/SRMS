import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import MenuCard from '../components/MenuCard';
import { RESTAURANT_INFO } from '../data/aiKnowledgeBase';

const STEPS = [
  {
    title: '1. Browse the menu',
    text: 'Filter by category, dietary requirement or price and read ingredients before you order.',
  },
  {
    title: '2. Order for delivery or pickup',
    text: 'Manage the cart, check out with a validated form and follow the status of your order.',
  },
  {
    title: '3. Book a table or an event',
    text: 'Reserve a table for a date and time, or request a birthday party or corporate gathering.',
  },
  {
    title: '4. Ask the AI assistant',
    text: 'Ask about specials, allergens, prices or what you ordered last time.',
  },
];

export default function Home() {
  const { menuItems, addToCart, notify, openAssistant } = useApp();

  // Derived data with useMemo: recalculated only when the menu changes.
  const specials = useMemo(() => menuItems.filter((item) => item.todaySpecial), [menuItems]);
  const popular = useMemo(
    () => menuItems.filter((item) => item.popular && item.available).slice(0, 4),
    [menuItems],
  );

  const handleAdd = (item) => {
    addToCart(item);
    notify(`${item.name} added to your cart.`);
  };

  return (
    <div className="container page">
      <section className="hero">
        <span className="kicker">{RESTAURANT_INFO.tagline}</span>
        <h1>Bella Vista Smart Restaurant Management System</h1>
        <p className="muted">
          Browse the full menu, order for delivery or pickup, book a table or a private event and ask
          our AI assistant anything about the restaurant. Administrators get a dashboard to manage the
          menu, follow orders and approve bookings.
        </p>
        <div className="btn-row">
          <Link className="btn primary" to="/menu">Browse the menu</Link>
          <Link className="btn" to="/reserve">Book a table</Link>
          <button className="btn" onClick={openAssistant}>
            Ask the AI assistant
          </button>
        </div>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <div className="card-heading">
          <h2>Today&apos;s specials</h2>
          <span className="muted small">Updated by the admin dashboard in real time</span>
        </div>
        {specials.length === 0 ? (
          <div className="empty">No specials set for today.</div>
        ) : (
          <div className="grid grid-2">
            {specials.map((item) => (
              <MenuCard key={item.id} item={item} onAdd={handleAdd} />
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <div className="card-heading">
          <h2>Popular right now</h2>
          <Link to="/menu">See the full menu →</Link>
        </div>
        <div className="grid grid-2">
          {popular.map((item) => (
            <MenuCard key={item.id} item={item} onAdd={handleAdd} />
          ))}
        </div>
      </section>

      <section className="split" style={{ marginTop: '2rem' }}>
        <div className="card">
          <h3>How it works</h3>
          <ul className="grid grid-2">
            {STEPS.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <p className="muted small">{step.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Visit us</h3>
          <p className="small muted">{RESTAURANT_INFO.address}</p>
          <ul className="small muted">
            {RESTAURANT_INFO.hours.map((row) => (
              <li key={row.day}>
                {row.day}: {row.hours}
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ marginTop: '0.75rem' }}>
            Delivery within {RESTAURANT_INFO.delivery.radius} — ${RESTAURANT_INFO.delivery.fee.toFixed(2)} (
            free over ${RESTAURANT_INFO.delivery.freeFrom.toFixed(2)}). Pickup ready in{' '}
            {RESTAURANT_INFO.pickup.eta}.
          </p>
          <Link className="btn small" to="/account">Create an account / sign in</Link>
        </div>
      </section>
    </div>
  );
}
