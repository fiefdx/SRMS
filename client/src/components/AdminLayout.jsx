import { NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../hooks/useApp';

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/menu', label: 'Menu items' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/reservations', label: 'Bookings' },
];

/**
 * Role gate + shared admin chrome. Only an authenticated admin can render the dashboard; every
 * nested admin page is rendered through <Outlet /> so they share one navigation bar.
 */
export default function AdminLayout() {
  const { user } = useApp();

  if (user?.role !== 'admin') {
    return (
      <div className="container page">
        <h1>Admin dashboard</h1>
        <div className="banner error">
          You must be signed in with the <strong>admin</strong> role to manage the restaurant.
        </div>
        <p className="muted">
          Sign in and tick “Sign in as administrator”, or use the admin demo email admin@srms.dev.
          Role-based access is simulated in the frontend for Assignment 1 and enforced by the backend
          in Assignment 2.
        </p>
        <NavLink className="btn primary" to="/account">
          Go to sign in
        </NavLink>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Admin dashboard</h1>
          <p>Manage the menu, follow incoming orders and approve reservations.</p>
        </div>
        <span className="chip accent">signed in as {user.name} (admin)</span>
      </div>

      <nav className="tabs" aria-label="Admin navigation">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: '1.25rem' }}>
        <Outlet />
      </div>
    </div>
  );
}
