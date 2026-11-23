/**
 * /api/admin — reporting for the restaurant. `router.use(authenticate, requireAdmin)` puts the role check
 * in front of every route in this file, so a forgotten check on one route cannot leak the figures.
 */
import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { dashboardQuerySchema, feedbackQuerySchema, popularQuerySchema, revenueQuerySchema } from '../validation/adminSchemas.js';
import {
  readDashboard,
  readFeedback,
  readFeedbackStats,
  readPopular,
  readReservations,
  readRevenue,
  readStatuses,
} from '../controllers/adminController.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/stats', validate(dashboardQuerySchema, 'query'), asyncHandler(readDashboard));
router.get('/stats/revenue', validate(revenueQuerySchema, 'query'), asyncHandler(readRevenue));
router.get('/stats/popular', validate(popularQuerySchema, 'query'), asyncHandler(readPopular));
router.get('/stats/statuses', asyncHandler(readStatuses));
router.get('/stats/reservations', asyncHandler(readReservations));
router.get('/feedback/stats', asyncHandler(readFeedbackStats));
router.get('/feedback', validate(feedbackQuerySchema, 'query'), asyncHandler(readFeedback));

export default router;
