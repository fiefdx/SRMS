import { Router } from 'express';
import config from '../config/env.js';
import { ping } from '../db/pool.js';
import adminRoutes from './adminRoutes.js';
import authRoutes from './authRoutes.js';
import eventRoutes from './eventRoutes.js';
import menuRoutes from './menuRoutes.js';
import orderRoutes from './orderRoutes.js';
import reservationRoutes from './reservationRoutes.js';
import userRoutes from './userRoutes.js';

/*
 * API entry point. Feature routers are mounted here as they are built:
 *   /api/auth  /api/users  /api/menu  /api/orders  /api/reservations  /api/events  /api/admin  /api/ai
 */
const router = Router();

router.get('/', (req, res) => {
  res.json({
    name: `${config.restaurant.name} — SRMS API`,
    version: '1',
    env: config.nodeEnv,
    endpoints: [
      'GET  /api/health',
      'GET  /api/health/db',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/users/me',
      'PATCH /api/users/me',
      'GET  /api/users/me/favourites',
      'PUT  /api/users/me/favourites',
      'GET  /api/users (admin)',
      'GET  /api/users/:userId',
      'PATCH /api/users/:userId',
      'DELETE /api/users/:userId (admin)',
      'GET  /api/menu',
      'GET  /api/menu/facets',
      'GET  /api/menu/:itemId',
      'POST /api/menu (admin)',
      'PATCH /api/menu/:itemId (admin)',
      'DELETE /api/menu/:itemId (admin)',
      'POST /api/orders (customer or guest)',
      'GET  /api/orders',
      'GET  /api/orders/reference/:reference',
      'GET  /api/orders/:orderId',
      'PATCH /api/orders/:orderId/items',
      'PATCH /api/orders/:orderId/status',
      'POST /api/orders/:orderId/feedback',
      'GET  /api/reservations/availability',
      'POST /api/reservations (customer or guest)',
      'GET  /api/reservations',
      'GET  /api/reservations/:reservationId',
      'PATCH /api/reservations/:reservationId',
      'PATCH /api/reservations/:reservationId/status',
      'DELETE /api/reservations/:reservationId (admin)',
      'POST /api/events',
      'GET  /api/events',
      'PATCH /api/events/:eventId',
      'GET  /api/admin/stats (admin)',
      'GET  /api/admin/stats/revenue (admin)',
      'GET  /api/admin/stats/popular (admin)',
      'GET  /api/admin/feedback (admin)',
      'POST /api/ai/ask',
    ],
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    env: config.nodeEnv,
    time: new Date().toISOString(),
  });
});

/**
 * Readiness probe: answers 200 only when the database answers, so this is the endpoint to watch in a
 * deploy. It is deliberately separate from /health, which must keep working while the database is
 * down, and it never opens a connection pool for a probe.
 */
router.get('/health/db', async (req, res) => {
  try {
    const connected = await ping();
    res.json({ status: 'ok', database: connected ? 'connected' : 'not connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: `unavailable: ${error.code ?? error.message}` });
  }
});

/* ---- resource routers ---- */
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/reservations', reservationRoutes);
router.use('/events', eventRoutes);
router.use('/admin', adminRoutes);

export default router;
