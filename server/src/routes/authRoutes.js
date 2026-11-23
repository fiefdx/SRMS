/**
 * /api/auth — registration, sign-in and session restore.
 * The pattern used by every router in this API: validate the input, call the service through
 * asyncHandler, let the error middleware produce the JSON error shape.
 */
import { Router } from 'express';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';
import { loginSchema, registerSchema } from '../validation/authSchemas.js';
import { currentAccount, registerAccount, signIn } from '../controllers/authController.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(registerAccount));
router.post('/login', validate(loginSchema), asyncHandler(signIn));
router.get('/me', authenticate, asyncHandler(currentAccount));

export default router;
