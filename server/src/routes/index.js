import { Router } from 'express';
import config from '../config/env.js';

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
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/users/me',
      'PATCH /api/users/me',
      'GET  /api/menu',
      'GET  /api/menu/:itemId',
      'POST /api/orders',
      'GET  /api/orders',
      'GET  /api/orders/:orderId',
      'PATCH /api/orders/:orderId/items',
      'GET  /api/reservations',
      'POST /api/reservations',
      'PATCH /api/reservations/:reservationId',
      'DELETE /api/reservations/:reservationId',
      'GET  /api/events',
      'POST /api/events',
      'GET  /api/admin/stats',
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

export default router;
