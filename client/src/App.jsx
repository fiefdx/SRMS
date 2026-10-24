import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Account from './pages/Account';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Orders from './pages/Orders';
import Reserve from './pages/Reserve';
import Reservations from './pages/Reservations';
import NotFound from './pages/NotFound';

/**
 * Route table. Each Assignment 1 feature gets its own route; the admin routes are added as a
 * nested group so the dashboard can share one layout.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/account" element={<Account />} />
      <Route path="/menu" element={<Menu />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order/:id" element={<OrderConfirmation />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/reserve" element={<Reserve />} />
      <Route path="/reservations" element={<Reservations />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
