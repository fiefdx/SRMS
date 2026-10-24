import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

/**
 * Route table. Each Assignment 1 feature gets its own route; the admin routes are added as a
 * nested group so the dashboard can share one layout.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
