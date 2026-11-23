/**
 * /api/users — user management.
 *
 * Every route needs a session (`router.use(authenticate)`), the admin-only ones also need
 * `requireAdmin`, and the `:userId` ones use `requireSelfOrAdmin` so a customer can read or edit their
 * own profile but nobody else's. `/me` is declared before `/:userId`, otherwise "me" would be read as an
 * id.
 */
import { Router } from 'express';
import { authenticate, requireAdmin, requireSelfOrAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { adminUserUpdateSchema, favouritesSchema, listUsersQuerySchema, profileUpdateSchema, userIdParamSchema } from '../validation/userSchemas.js';
import {
  editMyProfile,
  editProfile,
  listAccounts,
  myFavourites,
  myProfile,
  readProfile,
  removeAccount,
  replaceMyFavourites,
} from '../controllers/userController.js';

const router = Router();

router.use(authenticate);

router.get('/me', asyncHandler(myProfile));
router.patch('/me', validate(profileUpdateSchema), asyncHandler(editMyProfile));
router.get('/me/favourites', asyncHandler(myFavourites));
router.put('/me/favourites', validate(favouritesSchema), asyncHandler(replaceMyFavourites));

router.get('/', requireAdmin, validate(listUsersQuerySchema, 'query'), asyncHandler(listAccounts));

router.get('/:userId', requireSelfOrAdmin(), validate(userIdParamSchema, 'params'), asyncHandler(readProfile));
router.patch(
  '/:userId',
  requireSelfOrAdmin(),
  validate(userIdParamSchema, 'params'),
  validate(adminUserUpdateSchema),
  asyncHandler(editProfile),
);

router.delete('/:userId', requireAdmin, validate(userIdParamSchema, 'params'), asyncHandler(removeAccount));

export default router;
