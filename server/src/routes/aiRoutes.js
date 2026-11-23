/**
 * /api/ai — the customer-facing assistant. A token is optional: with one the answers can be personal
 * ("what did I order last time?"), without one the assistant sticks to public facts.
 */
import { Router } from 'express';
import { optionalAuthenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { askSchema } from '../validation/aiSchemas.js';
import { ask } from '../controllers/aiController.js';

const router = Router();

router.post('/ask', optionalAuthenticate, validate(askSchema), asyncHandler(ask));

export default router;
