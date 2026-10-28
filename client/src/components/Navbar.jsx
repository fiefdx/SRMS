import { Link, NavLink } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { RESTAURANT_INFO } from '../data/aiKnowledgeBase';

/**
 * Navigation demonstrates:
 *  - NavLink for "active" styling (routing)
 *  - conditional rendering of the admin links based on the signed-in role
 *  - derived state (cart badge) read from the context
 */
export default function Navbar() {
  const { cartCount, user, signOut } = useApp();

  const customerLinks = [
    { to: '/menu', label: 'Menu' },
    { to: '/reservations', label: 'Reservations' },
    { to: '/orders', label: 'My orders' },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/menu', label: 'Menu' },
    { to: '/admin/orders', label: 'Orders' },
    { to: '/admin/reservations', label: 'Bookings' },
  ];

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link className="brand" to="/">
          <span className="mark">🍽️</span>
          <span>{RESTAURANT_INFO.name} · SRMS</span>
        </Link>

        <nav className="nav-links" aria-label="Main navigation">
          {user?.role === 'admin'
            ? adminLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  {link.label}
                </NavLink>
              ))
            : customerLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  {link.label}
                </NavLink>
              ))}

          {user?.role !== 'admin' && (
            <NavLink to="/cart" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Cart {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </NavLink>
          )}

          {user ? (
            <span className="chip accent">
              {user.name} · {user.role}
              <button className="btn small ghost" onClick={signOut} style={{ marginLeft: 6 }}>
                Sign out
              </button>
            </span>
          ) : (
            <NavLink to="/account" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Sign in
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
